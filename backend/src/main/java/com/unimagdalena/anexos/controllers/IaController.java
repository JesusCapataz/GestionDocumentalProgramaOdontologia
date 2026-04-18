package com.unimagdalena.anexos.controllers;

import com.unimagdalena.anexos.repositories.AnexoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.Arrays;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ia")
@CrossOrigin(origins = {"http://localhost:4200", "https://delightful-river-0e24c4810.1.azurestaticapps.net"})
@RequiredArgsConstructor
public class IaController {

    private final AnexoRepository anexoRepository;
    private final RestTemplate restTemplate;

    @Value("${groq.api.keys}")
    private String groqApiKeysRaw;

    private List<String> groqApiKeysList;
    private final java.util.concurrent.atomic.AtomicInteger keyIndex
            = new java.util.concurrent.atomic.AtomicInteger(0);

    @jakarta.annotation.PostConstruct
    public void initKeys() {
        groqApiKeysList = Arrays.stream(groqApiKeysRaw.split(","))
                .map(String::trim)
                .filter(k -> !k.isBlank())
                .collect(Collectors.toList());
        if (groqApiKeysList.isEmpty()) {
            throw new IllegalStateException("[IaController] groq.api.keys está vacío. Revisa tu configuración.");
        }
        System.out.println("[IaController] " + groqApiKeysList.size() + " clave(s) Groq cargada(s).");
    }

    private String getNextApiKey() {
        int idx = keyIndex.getAndIncrement() % groqApiKeysList.size();
        return groqApiKeysList.get(idx);
    }

    // ── Rate Limiter en memoria ───────────────────────────────────────────────
    // Ventana de ráfagas: clave = correo, valor = deque de timestamps
    private final java.util.concurrent.ConcurrentHashMap<String, java.util.Deque<Long>> rateLimitMap
            = new java.util.concurrent.ConcurrentHashMap<>();

    // Límite diario: clave = "correo::YYYY-MM-DD", valor = contador de consultas del día
    private final java.util.concurrent.ConcurrentHashMap<String, java.util.concurrent.atomic.AtomicInteger> dailyLimitMap
            = new java.util.concurrent.ConcurrentHashMap<>();

    private ResponseEntity<Map<String, String>> verificarRateLimit(String correo, String rol) {
        // ── Configuración por rol ─────────────────────────────────────────────
        int maxRafaga;
        int maxDiario;
        switch (rol) {
            case "SUPER_ADMIN":
                maxRafaga  = 15;
                maxDiario  = 100;
                break;
            case "ADMINISTRADOR":
            case "DOCENTE":
                maxRafaga  = 8;
                maxDiario  = 70;
                break;
            default: // ESTUDIANTE y cualquier otro
                maxRafaga  = 3;
                maxDiario  = 30;
                break;
        }
        long ventanaMs = 10 * 60 * 1000L;

        // ── VALIDACIÓN 1: Límite diario (timezone Colombia) ───────────────────
        String fechaHoy = java.time.LocalDate
                .now(java.time.ZoneId.of("America/Bogota"))
                .toString(); // "YYYY-MM-DD"
        String claveDialria = correo + "::" + fechaHoy;

        dailyLimitMap.putIfAbsent(claveDialria, new java.util.concurrent.atomic.AtomicInteger(0));
        java.util.concurrent.atomic.AtomicInteger contadorDia = dailyLimitMap.get(claveDialria);

        if (contadorDia.get() >= maxDiario) {
            return ResponseEntity.status(429).body(Map.of(
                "error", "Has alcanzado tu límite máximo de " + maxDiario + " consultas diarias. Por favor, intenta de nuevo mañana.",
                "waitMinutes", "1440"
            ));
        }

        // ── VALIDACIÓN 2: Límite de ráfaga (sliding window 10 min) ───────────
        long ahora = System.currentTimeMillis();
        rateLimitMap.putIfAbsent(correo, new java.util.ArrayDeque<>());
        java.util.Deque<Long> timestamps = rateLimitMap.get(correo);

        synchronized (timestamps) {
            while (!timestamps.isEmpty() && (ahora - timestamps.peekFirst()) > ventanaMs) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= maxRafaga) {
                long esperaMs  = ventanaMs - (ahora - timestamps.peekFirst());
                long esperaMin = (long) Math.ceil(esperaMs / 60000.0);
                return ResponseEntity.status(429).body(Map.of(
                    "error", "Has alcanzado el límite de consultas por minuto. Por favor espera " + esperaMin + " minuto(s).",
                    "waitMinutes", String.valueOf(esperaMin)
                ));
            }
            timestamps.addLast(ahora);
        }

        // ── Registramos la consulta en el contador diario ─────────────────────
        contadorDia.incrementAndGet();

        return null; // null = puede continuar
    }

    @PostMapping("/consultar")
    public ResponseEntity<Map<String, String>> consultar(
            @RequestBody Map<String, String> body,
            org.springframework.security.core.Authentication authentication) {

        // ── Rate Limiter ──────────────────────────────────────────────────────
        String correo = authentication != null ? authentication.getName() : "anonimo";
        String rol = "ESTUDIANTE";
        if (authentication != null) {
            rol = authentication.getAuthorities().stream()
                    .map(a -> a.getAuthority().replace("ROLE_", ""))
                    .findFirst().orElse("ESTUDIANTE");
        }
        ResponseEntity<Map<String, String>> limiteRespuesta = verificarRateLimit(correo, rol);
        if (limiteRespuesta != null) return limiteRespuesta;

        String pregunta = body.get("pregunta");
        if (pregunta == null || pregunta.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "La pregunta no puede estar vacía"));
        }

        // ── RAG: calculamos relevancia antes de construir el contexto ──────────
        String preguntaNorm = java.text.Normalizer
                .normalize(pregunta.toLowerCase(), java.text.Normalizer.Form.NFD)
                .replaceAll("[\\p{InCombiningDiacriticalMarks}]", "")
                .replaceAll("[¿?¡!,.:;\"'()\\[\\]]", " ")
                .replaceAll("\\s+", " ")
                .trim();

        // Stop-words en español + términos propios del dominio que no aportan señal
        // Stop-words en español + términos propios del dominio que no aportan señal
        Set<String> stopWords = new HashSet<>(Arrays.asList(
                // Artículos
                "el","la","los","las","un","una","unos","unas","lo",
                // Preposiciones
                "a","ante","bajo","con","contra","de","desde","durante","en",
                "entre","hacia","hasta","mediante","para","por","segun","sin",
                "sobre","tras","versus","via",
                // Conjunciones
                "y","e","ni","o","u","pero","sino","aunque","porque","que",
                "si","cuando","como","donde","mientras","pues",
                // Pronombres comunes
                "yo","tu","ella","nosotros","vosotros","ellos","ellas",
                "me","te","se","nos","os","le","les",
                "este","esta","estos","estas","ese","esa","esos","esas",
                // Verbos auxiliares y muy comunes
                "es","son","esta","estan","fue","ser","estar","hay","tiene",
                "tener","hacer","ver","saber","poder","querer","deber",
                // Adverbios vacíos
                "no","si","mas","menos","muy","bien","mal","tambien",
                "ya","aun","solo","aqui","alli","ahora",
                // Términos propios del dominio que no aportan señal
                "anexo","anexos","documento","documentos","archivo","archivos",
                "repositorio","institucional","programa","odontologia","universidad",
                // Frases de cortesía / lenguaje natural
                "ayudame","necesito","busco","quiero","encontrar",
                "encontrarlo","encontrarla","favor","gracias","hola",
                "buenas","dias","tardes","noches","porfavor","porfa",
                "muéstrame","muestrame","dime","dame"
        ));

        // ── PASO 0: Query Expansion via Gemini (solo si 4+ términos útiles) ──
        String terminosExpandidos = preguntaNorm;
        long palabrasUtilesEnPregunta = Arrays.stream(preguntaNorm.split("\\s+"))
                .filter(t -> t.length() >= 3 && !stopWords.contains(t))
                .count();

        if (palabrasUtilesEnPregunta > 3) {
            try {
                HttpHeaders headersExp = new HttpHeaders();
                headersExp.setContentType(MediaType.APPLICATION_JSON);

                String promptExp = "Eres un extractor de keywords para un repositorio universitario de odontología. "
                        + "Responde ÚNICAMENTE con las palabras clave y sus sinónimos más relevantes del dominio universitario, separadas por espacio. "
                        + "Sin puntuación, sin explicaciones, sin oraciones. Solo palabras. "
                        + "Entrada: '" + pregunta + "' Salida:";

                Map<String, Object> msgExp     = Map.of("role", "user", "content", promptExp);
                Map<String, Object> bodyExpMap = new HashMap<>();
                bodyExpMap.put("model", "llama-3.3-70b-versatile");
                bodyExpMap.put("messages", List.of(msgExp));
                bodyExpMap.put("max_tokens", 60);
                bodyExpMap.put("temperature", 0.0);

                ResponseEntity<Map> respExp = null;
                for (int intento = 0; intento < groqApiKeysList.size(); intento++) {
                    try {
                        headersExp.set("Authorization", "Bearer " + getNextApiKey());
                        HttpEntity<Map<String, Object>> reqExp = new HttpEntity<>(bodyExpMap, headersExp);
                        respExp = restTemplate.postForEntity(
                                "https://api.groq.com/openai/v1/chat/completions",
                                reqExp, Map.class);
                        break; // éxito — salimos del bucle
                    } catch (org.springframework.web.client.HttpStatusCodeException exRetry) {
                        if (exRetry.getStatusCode().value() == 429 && intento < groqApiKeysList.size() - 1) {
                            System.err.println("[QueryExpansion] 429 en clave " + intento + ", rotando...");
                        } else {
                            throw exRetry; // no es 429 o agotamos claves → sube al catch externo
                        }
                    }
                }

                if (respExp != null && respExp.getBody() != null) {
                    List<Map<String, Object>> choices = (List<Map<String, Object>>) respExp.getBody().get("choices");
                    if (choices != null && !choices.isEmpty()) {
                        Map<String, Object> messageExp = (Map<String, Object>) choices.get(0).get("message");
                        if (messageExp != null && messageExp.get("content") != null) {
                            String expansion = messageExp.get("content").toString().trim();
                            expansion = java.text.Normalizer
                                    .normalize(expansion.toLowerCase(), java.text.Normalizer.Form.NFD)
                                    .replaceAll("[\\p{InCombiningDiacriticalMarks}]", "")
                                    .replaceAll("[¿?¡!,.:;\"'()\\[\\]]", " ")
                                    .replaceAll("\\s+", " ").trim();
                            terminosExpandidos = preguntaNorm + " " + expansion;
                        }
                    }
                }
            } catch (Exception expEx) {
                terminosExpandidos = preguntaNorm;
                System.err.println("[QueryExpansion] Falló, usando términos originales: " + expEx.getMessage());
            }
        } else {
            System.out.println("[QueryExpansion] Pregunta corta (" + palabrasUtilesEnPregunta + " términos útiles), saltando expansión.");
        }

        String[] terminosBusqueda = Arrays.stream(terminosExpandidos.split("\\s+"))
                .filter(t -> t.length() >= 3)
                .filter(t -> !stopWords.contains(t))
                .distinct()
                .toArray(String[]::new);

        List<com.unimagdalena.anexos.entities.Anexo> todosLosAnexos = anexoRepository.findAll();

        // ── FASE 1: Scoring Global — puntuamos el documento completo ─────────
        // Los metadatos (nombre, descripción) pesan más que el contenido
        List<Map.Entry<com.unimagdalena.anexos.entities.Anexo, Integer>> puntuados = todosLosAnexos.stream()
                .map(a -> {
                    // Zona A: metadatos — cada match vale 3 puntos
                    String zonaA = java.text.Normalizer.normalize((
                            (a.getNombre()             != null ? a.getNombre()             : "") + " " +
                            (a.getDescripcion()        != null ? a.getDescripcion()        : "") + " " +
                            (a.getCategoriaPrincipal() != null ? a.getCategoriaPrincipal() : "") + " " +
                            (a.getCategoriaSecundaria()!= null ? a.getCategoriaSecundaria(): "") + " " +
                            (a.getTipoDocumento()      != null ? a.getTipoDocumento()      : "")
                    ).toLowerCase(), java.text.Normalizer.Form.NFD)
                            .replaceAll("[\\p{InCombiningDiacriticalMarks}]", "");

                    // Zona B: contenido completo — cada match vale 1 punto
                    String zonaB = a.getContenidoTexto() != null
                            ? java.text.Normalizer.normalize(
                                a.getContenidoTexto().toLowerCase(),
                                java.text.Normalizer.Form.NFD)
                              .replaceAll("[\\p{InCombiningDiacriticalMarks}]", "")
                            : "";

                    int puntos = 0;
                    for (String termino : terminosBusqueda) {
                        if (termino.length() < 3) continue;
                        if (zonaA.contains(termino)) puntos += 3;
                        else if (zonaB.contains(termino)) puntos += 1;
                    }
                    // ── Exact Phrase Match Bonus ──────────────────────────────
                    // Si la frase completa aparece literal, domina el ranking
                    if (!preguntaNorm.isBlank()) {
                        if (zonaA.contains(preguntaNorm)) puntos += 20;
                        else if (zonaB.contains(preguntaNorm)) puntos += 10;
                    }
                    return Map.entry(a, puntos);
                })
                .sorted((x, y) -> y.getValue() - x.getValue())
                .collect(Collectors.toList());

        // Top 7 con puntaje > 0; fallback a 5 primeros
        List<com.unimagdalena.anexos.entities.Anexo> anexosRelevantes = puntuados.stream()
                .filter(e -> e.getValue() > 0)
                .limit(7)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        if (anexosRelevantes.isEmpty()) {
            anexosRelevantes = puntuados.stream()
                    .limit(5)
                    .map(Map.Entry::getKey)
                    .collect(Collectors.toList());
        }

        // ── FASE 2: Snippet Extraction — solo a los 3 ganadores ──────────────
        // Sliding window de 1000 chars (overlap 200) — bug fix: toLowerCase solo para
        // la evaluación del match, pero capturamos el fragmento con gramática original
        String contexto = anexosRelevantes.stream()
                .map(a -> {
                    String base = String.format(
                            "ID:%d | Nombre: %s | Año: %s | Cat.Principal: %s | Cat.Secundaria: %s | Descripción: %s | Número: %s | Tipo: %s | Fuente: %s",
                            a.getId(),
                            a.getNombre(),
                            a.getAnio() != null ? a.getAnio() : "sin año",
                            a.getCategoriaPrincipal(),
                            a.getCategoriaSecundaria(),
                            a.getDescripcion() != null ? a.getDescripcion() : "sin descripción",
                            a.getNumeroAnexo() != null ? a.getNumeroAnexo() : "",
                            a.getTipoDocumento() != null ? a.getTipoDocumento() : "",
                            a.getFuente() != null ? a.getFuente() : ""
                    );
                    if (a.getContenidoTexto() != null && !a.getContenidoTexto().isBlank()) {
                        // Original limpio (sin tildes, con mayúsculas) — para enviar al LLM
                        String contenidoOriginal = java.text.Normalizer.normalize(
                                a.getContenidoTexto().replaceAll("\\s+", " ").trim(),
                                java.text.Normalizer.Form.NFD)
                                .replaceAll("[\\p{InCombiningDiacriticalMarks}]", "");

                        // Versión en minúsculas — solo para evaluar coincidencias
                        String contenidoLower = contenidoOriginal.toLowerCase();

                        int ventana = 600;
                        int paso    = ventana - 150;

                        String mejorFragmento = contenidoOriginal.substring(0, Math.min(ventana, contenidoOriginal.length()));
                        int    mejorPuntaje   = 0;

                        for (int inicio = 0; inicio < contenidoLower.length(); inicio += paso) {
                            int fin      = Math.min(inicio + ventana, contenidoLower.length());
                            String chunk = contenidoLower.substring(inicio, fin);
                            int puntajeChunk = 0;
                            for (String termino : terminosBusqueda) {
                                if (termino.length() >= 3 && chunk.contains(termino)) puntajeChunk++;
                            }
                            if (puntajeChunk > mejorPuntaje) {
                                mejorPuntaje   = puntajeChunk;
                                // Capturamos el fragmento desde el original (con mayúsculas reales)
                                mejorFragmento = contenidoOriginal.substring(inicio, fin);
                            }
                            if (fin == contenidoLower.length()) break;
                        }
                        base += " | Fragmento relevante: " + mejorFragmento;
                    }
                    return base;
                })
                .collect(Collectors.joining("\n\n"));

        String prompt = "Eres un asistente del Repositorio Institucional del Programa de Odontología de la Universidad del Magdalena.\n\n"
                + "TAREA: Analiza la consulta del usuario y encuentra los anexos MÁS relevantes de la lista.\n"
                + "Usa análisis semántico: busca sinónimos, conceptos relacionados y términos afines.\n"
                + "Ejemplos: 'vicerrectoría'→administración,proyectos; 'clínica'→prácticas,bioseguridad; 'reglamento'→normativa,políticas\n\n"
                + "LISTA DE ANEXOS:\n" + contexto + "\n\n"
                + "CONSULTA: " + pregunta + "\n\n"
                + "REGLAS OBLIGATORIAS:\n"
                + "- Si la consulta NO está relacionada con ningún anexo de la lista, responde SOLO: 'No encontré anexos relacionados con tu consulta. Intenta con otras palabras clave.'\n"
                + "- Si hay anexos relacionados, muestra MÁXIMO 3, SOLO los que tengan relación real con la consulta.\n"
                + "- NO muestres un anexo si no tiene relación con la consulta.\n"
                + "- NUNCA repitas la lista completa de anexos.\n"
                + "- NUNCA inventes información.\n"
                + "- MUY IMPORTANTÍSIMO: Si la consulta es una palabra corta (ej. 'rio') y esa palabra aparece LITERALMENTE en el título o fragmento de un anexo, ES OBLIGATORIO MOSTRAR ESE ANEXO. No descartes por falta de contexto. Prioriza la coincidencia exacta del título.\n\n"
                + "FORMATO DE RESPUESTA OBLIGATORIO (sigue este formato exacto, sin variaciones):\n"
                + "Primero escribe una frase introductoria breve.\n"
                + "Luego por cada anexo relevante escribe EXACTAMENTE en una línea:\n"
                + "RESULTADO:[id]|[nombre exacto del anexo]|[razón breve de máximo 10 palabras]\n"
                + "Al final escribe una frase de cierre breve.\n\n"
                + "EJEMPLO de respuesta correcta:\n"
                + "Encontré anexos relacionados con infraestructura:\n"
                + "RESULTADO:12|Anexo 141. Banco de proyectos infraestructura|Banco de proyectos de infraestructura institucional.\n"
                + "Espero que te sea útil.\n\n"
                + "NOTA: El fragmento de contenido puede provenir de cualquier página del documento — "
                + "el sistema ha escaneado el documento completo y seleccionado la sección más relevante para tu consulta.\n"
                + "IMPORTANTE: El formato RESULTADO: es obligatorio. Sin él, los resultados no se mostrarán.";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> mensajeFinal = Map.of("role", "user", "content", prompt);
        Map<String, Object> requestBody  = new HashMap<>();
        requestBody.put("model", "llama-3.3-70b-versatile");
        requestBody.put("messages", List.of(mensajeFinal));
        requestBody.put("max_tokens", 1024);
        requestBody.put("temperature", 0.3);

        try {
            ResponseEntity<Map> response = null;
            for (int intento = 0; intento < groqApiKeysList.size(); intento++) {
                try {
                    headers.set("Authorization", "Bearer " + getNextApiKey());
                    HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
                    response = restTemplate.postForEntity(
                            "https://api.groq.com/openai/v1/chat/completions",
                            request, Map.class);
                    break; // éxito — salimos del bucle
                } catch (org.springframework.web.client.HttpStatusCodeException exRetry) {
                    if (exRetry.getStatusCode().value() == 429 && intento < groqApiKeysList.size() - 1) {
                        System.err.println("[IA Principal] 429 en clave " + intento + ", rotando...");
                    } else {
                        throw exRetry; // no es 429 o agotamos claves → sube al catch externo
                    }
                }
            }

            List<Map<String, Object>> choices = (List<Map<String, Object>>) response.getBody().get("choices");
            Map<String, Object> messageFinal  = (Map<String, Object>) choices.get(0).get("message");
            String respuestaIA                = messageFinal.get("content").toString();

            return ResponseEntity.ok(Map.of("respuesta", respuestaIA));

        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            int status = e.getStatusCode().value();
            String cuerpo = e.getResponseBodyAsString();

            if (status == 503 || cuerpo.contains("Service Unavailable") || cuerpo.contains("overloaded")) {
                return ResponseEntity.status(503)
                        .body(Map.of("error", "Los servidores del asistente están saturados en este momento. Por favor, intenta de nuevo en unos minutos."));
            }
            if (status == 429 || cuerpo.contains("rate_limit") || cuerpo.contains("RESOURCE_EXHAUSTED")) {
                return ResponseEntity.status(429)
                        .body(Map.of("error", "El asistente de IA alcanzó su límite de cuota. Espera un momento e intenta de nuevo."));
            }
            if (cuerpo.contains("tokens") || cuerpo.contains("Payload Too Large")) {
                return ResponseEntity.status(413)
                        .body(Map.of("error", "La consulta generó demasiado contexto. Intenta con palabras más específicas."));
            }
            System.err.println("[IaController] HttpStatusCodeException " + status + ": " + cuerpo);
            return ResponseEntity.status(500)
                    .body(Map.of("error", "Error al conectar con la IA. Intenta de nuevo."));
        } catch (Exception e) {
            System.err.println("[IaController] Error inesperado: " + e.getMessage());
            return ResponseEntity.status(500)
                    .body(Map.of("error", "Error interno del servidor. Intenta de nuevo."));
        }
    }
}