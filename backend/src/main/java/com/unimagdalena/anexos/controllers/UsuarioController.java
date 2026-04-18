package com.unimagdalena.anexos.controllers;

import com.unimagdalena.anexos.entities.Usuario;
import com.unimagdalena.anexos.exceptions.ResourceNotFoundException;
import com.unimagdalena.anexos.repositories.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import com.unimagdalena.anexos.dto.RolUpdateRequest;
import com.unimagdalena.anexos.dto.UsuarioResumenDTO;
import com.unimagdalena.anexos.entities.Role;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/usuarios")
@CrossOrigin(origins = {"http://localhost:4200", "https://delightful-river-0e24c4810.1.azurestaticapps.net"})
@RequiredArgsConstructor
public class UsuarioController {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    // ────────────────────────────────────────────────────────
    // PUT /api/usuarios/perfil
    // El ID nunca viaja por la red: lo extraemos del JWT
    // ────────────────────────────────────────────────────────
    @PutMapping("/perfil")
    public ResponseEntity<Map<String, String>> actualizarPerfil(
            @RequestBody Map<String, String> body,
            Authentication authentication) {

        String correo = authentication.getName();   // viene del token

        Usuario usuario = usuarioRepository.findByCorreo(correo)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        String nuevoNombre    = body.get("nombre");
        String nuevoApellido  = body.get("apellido");

        if (nuevoNombre == null || nuevoNombre.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "El campo 'nombre' es obligatorio"));
        }

        usuario.setNombre(nuevoNombre.trim());

        // apellido es opcional en la petición; solo lo pisamos si llega
        if (nuevoApellido != null && !nuevoApellido.isBlank()) {
            usuario.setApellido(nuevoApellido.trim());
        }

        usuarioRepository.save(usuario);

        return ResponseEntity.ok(Map.of(
                "mensaje",  "Perfil actualizado correctamente",
                "nombre",   usuario.getNombre(),
                "apellido", usuario.getApellido()
        ));
    }

    // ────────────────────────────────────────────────────────
    // PUT /api/usuarios/password
    // Verifica la clave actual antes de guardar la nueva
    // ────────────────────────────────────────────────────────

    @PostMapping("/verificar-password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, String>> verificarPassword(
            @RequestBody Map<String, String> body,
            Authentication authentication) {

        String correo = authentication.getName();
        Usuario usuario = usuarioRepository.findByCorreo(correo)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        String passwordIngresada = body.get("password");

        if (!passwordEncoder.matches(passwordIngresada, usuario.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Contraseña incorrecta"));
        }

        return ResponseEntity.ok(Map.of("mensaje", "Contraseña correcta"));
    }

    @PutMapping("/password")
    public ResponseEntity<Map<String, String>> actualizarPassword(
            @RequestBody Map<String, String> body,
            Authentication authentication) {

        String correo = authentication.getName();

        Usuario usuario = usuarioRepository.findByCorreo(correo)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        String passwordActual = body.get("actual");
        String passwordNueva  = body.get("nueva");

        if (passwordActual == null || passwordNueva == null
                || passwordActual.isBlank() || passwordNueva.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Los campos 'actual' y 'nueva' son obligatorios"));
        }

        // Verificamos la contraseña actual contra el hash guardado en BD
        if (!passwordEncoder.matches(passwordActual, usuario.getPassword())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "La contraseña actual es incorrecta"));
        }

        usuario.setPassword(passwordEncoder.encode(passwordNueva));
        usuarioRepository.save(usuario);

        return ResponseEntity.ok(Map.of("mensaje", "Contraseña actualizada correctamente"));
    }

    // ── Agrega estos imports al controlador existente ─────────────

    // ─────────────────────────────────────────────────────────────
// GET /api/usuarios/todos — Solo SUPER_ADMIN
// Retorna lista sin exponer password ni datos de Spring Security
// ─────────────────────────────────────────────────────────────
    @GetMapping("/todos")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<UsuarioResumenDTO>> obtenerTodos(
            Authentication authentication) {

        List<UsuarioResumenDTO> lista = usuarioRepository.findAll()
                .stream()
                .map(u -> UsuarioResumenDTO.builder()
                        .id(u.getId())
                        .nombre(u.getNombre())
                        .apellido(u.getApellido())
                        .correo(u.getCorreo())
                        .rol(u.getRol())
                        .build())
                .collect(Collectors.toList());

        return ResponseEntity.ok(lista);
    }

    // ─────────────────────────────────────────────────────────────
// PUT /api/usuarios/{id}/rol — Solo SUPER_ADMIN
// Reglas de oro: no puedes tocarte a ti mismo ni a otro SUPER_ADMIN
// ─────────────────────────────────────────────────────────────
    @PutMapping("/{id}/rol")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Map<String, String>> cambiarRol(
            @PathVariable Long id,
            @RequestBody RolUpdateRequest request,
            Authentication authentication) {

        // 1. Quién ejecuta la acción
        String correoEjecutor = authentication.getName();
        Usuario ejecutor = usuarioRepository.findByCorreo(correoEjecutor)
                .orElseThrow(() -> new RuntimeException("Ejecutor no encontrado"));

        // 2. Regla: nadie puede cambiarse a sí mismo
        if (ejecutor.getId().equals(id)) {
            return ResponseEntity
                    .status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "No puedes cambiar tu propio rol"));
        }

        // 3. Quién es el objetivo
        Usuario objetivo = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuario no encontrado con ID: " + id));

        // 4. Regla: el rol SUPER_ADMIN es intocable
        if (objetivo.getRol() == Role.SUPER_ADMIN) {
            return ResponseEntity
                    .status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error",
                            "El rol SUPER_ADMIN no puede modificarse"));
        }

        // 5. Actualizar y guardar
        objetivo.setRol(request.getNuevoRol());
        usuarioRepository.save(objetivo);

        return ResponseEntity.ok(Map.of(
                "mensaje",  "Rol actualizado correctamente",
                "nuevoRol", objetivo.getRol().name()
        ));
    }
}