package com.unimagdalena.anexos.controllers;

import com.unimagdalena.anexos.entities.Anexo;
import com.unimagdalena.anexos.entities.Usuario;
import com.unimagdalena.anexos.repositories.UsuarioRepository;
import com.unimagdalena.anexos.services.AnexoService;
import com.unimagdalena.anexos.services.AzureBlobService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.nio.file.*;
import java.io.File;
import java.time.LocalDateTime;
import java.util.List;


@RestController
@RequestMapping("/api/anexos")
@CrossOrigin(origins = {"http://localhost:4200", "https://delightful-river-0e24c4810.1.azurestaticapps.net"})
@RequiredArgsConstructor
public class AnexoController {

    private final AnexoService anexoService;
    private final UsuarioRepository usuarioRepository;
    private final AzureBlobService azureBlobService;

    @GetMapping
    public ResponseEntity<List<Anexo>> obtenerTodos() {
        return ResponseEntity.ok(anexoService.obtenerTodos());
    }

    @GetMapping("/actualizados")
    public ResponseEntity<List<Anexo>> obtenerActualizados() {
        return ResponseEntity.ok(anexoService.obtenerActualizadosRecientemente());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Anexo> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(anexoService.obtenerPorId(id));
    }

    @PostMapping
    public ResponseEntity<Anexo> crearAnexo(@RequestBody Anexo anexo, Authentication authentication) {
        String correo = authentication.getName();
        Usuario usuario = usuarioRepository.findByCorreo(correo)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado en la base de datos"));

        anexo.setUsuario(usuario);
        anexo.setFechaSubida(LocalDateTime.now());
        return ResponseEntity.ok(anexoService.guardarAnexo(anexo));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Anexo> actualizarAnexo(
            @PathVariable Long id,
            @RequestBody Anexo anexo,
            @RequestParam(value = "eliminarArchivo", defaultValue = "false") boolean eliminarArchivo) {
        Anexo actualizado = anexoService.actualizarAnexo(id, anexo, eliminarArchivo);
        return ResponseEntity.ok(actualizado);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarAnexo(@PathVariable Long id) {
        anexoService.eliminarAnexo(id);
        return ResponseEntity.noContent().build();
    }

    // ====================================================================
    // NUEVAS PUERTAS PARA MANEJAR ARCHIVOS (Subir y Ver)
    // ====================================================================

    @PostMapping("/{id}/archivo")
    public ResponseEntity<String> subirArchivo(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) throws Exception {

        Anexo anexo = anexoService.obtenerPorId(id);
        String fileName = id + "." + getExtension(file.getOriginalFilename());

        // Subir usando el servicio inyectado
        azureBlobService.subirArchivo(fileName, file);

        // Extraer texto si es PDF
        String contenido = "[ARCHIVO_SUBIDO]"; // marcador mínimo para que tieneArchivo = true
        if (getExtension(file.getOriginalFilename()).toLowerCase().equals("pdf")) {
            try (org.apache.pdfbox.pdmodel.PDDocument doc =
                         org.apache.pdfbox.Loader.loadPDF(file.getBytes())) {
                org.apache.pdfbox.text.PDFTextStripper stripper =
                        new org.apache.pdfbox.text.PDFTextStripper();
                String texto = stripper.getText(doc);
                if (texto != null && !texto.isBlank()) {
                    contenido = texto.length() > 8000 ? texto.substring(0, 8000) : texto;
                }
            } catch (Exception e) { /* contenido queda como marcador */ }
        }

        anexo.setContenidoTexto(contenido);
        anexoService.guardarAnexo(anexo);
        return ResponseEntity.ok("Archivo subido correctamente");
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "bin";
        return filename.substring(filename.lastIndexOf(".") + 1);
    }

    @GetMapping("/{id}/archivo")
    public ResponseEntity<byte[]> verArchivoFisico(@PathVariable Long id) {
        try {
            String nombreBlob = azureBlobService.encontrarNombreBlob(id);
            if (nombreBlob == null) return ResponseEntity.notFound().build();

            java.io.InputStream stream = azureBlobService.descargarArchivo(nombreBlob);
            if (stream == null) return ResponseEntity.notFound().build();

            byte[] data = stream.readAllBytes();
            String ext = nombreBlob.substring(nombreBlob.lastIndexOf(".") + 1).toLowerCase();
            String contentType = switch (ext) {
                case "pdf"  -> "application/pdf";
                case "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                case "xls"  -> "application/vnd.ms-excel";
                case "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                case "doc"  -> "application/msword";
                case "pptx" -> "application/vnd.openxmlformats-officedocument.presentationml.presentation";
                case "ppt"  -> "application/vnd.ms-powerpoint";
                case "txt"  -> "text/plain";
                default     -> "application/octet-stream";
            };
            String disposicion = ext.equals("pdf") ? "inline" : "attachment";

            return ResponseEntity.ok()
                    .contentType(org.springframework.http.MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, disposicion + "; filename=\"" + nombreBlob + "\"")
                    .body(data);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    @DeleteMapping("/{id}/archivo")
    public ResponseEntity<java.util.Map<String, String>> eliminarArchivoFisico(@PathVariable Long id) {
        try {
            String nombreBlob = azureBlobService.encontrarNombreBlob(id);
            if (nombreBlob != null) azureBlobService.borrarArchivo(nombreBlob);
            return ResponseEntity.ok(java.util.Map.of("mensaje", "Archivo eliminado"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(java.util.Map.of("error", e.getMessage()));
        }
    }
}
