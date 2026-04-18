package com.unimagdalena.anexos.services;

import com.unimagdalena.anexos.dto.AuthResponse;
import com.unimagdalena.anexos.dto.LoginRequest;
import com.unimagdalena.anexos.dto.RegisterRequest;
import com.unimagdalena.anexos.entities.Usuario;
import com.unimagdalena.anexos.repositories.UsuarioRepository;
import com.unimagdalena.anexos.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthResponse register(RegisterRequest request) {
        var user = Usuario.builder()
                .nombre(request.getNombre())
                .apellido(request.getApellido())
                .correo(request.getCorreo())
                // Encriptamos la clave antes de guardarla
                .password(passwordEncoder.encode(request.getPassword()))

                // Ignoramos request.getRol() para evitar Inyección de Privilegios.
                // Todo usuario que se registre por sí mismo nace SIN PODER (ESTUDIANTE).
                .rol(com.unimagdalena.anexos.entities.Role.ESTUDIANTE)

                .build();

        usuarioRepository.save(user);

        var jwtToken = jwtService.generateToken(user);

        return AuthResponse.builder()
                .token(jwtToken)
                .correo(user.getCorreo())
                .rol(user.getRol().name())
                .nombre(user.getNombre())
                .apellido(user.getApellido())
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        // 1. Validamos credenciales con Spring Security
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getCorreo(),
                        request.getPassword()
                )
        );

        // 2. Buscamos al usuario en la BD
        var user = usuarioRepository.findByCorreo(request.getCorreo())
                .orElseThrow();

        // --- CAMBIO AQUÍ: Usamos 'generateToken' en lugar de 'getToken' ---
        var jwtToken = jwtService.generateToken(user);

        return AuthResponse.builder()
                .token(jwtToken)
                .correo(user.getCorreo())
                .rol(user.getRol().name())
                .nombre(user.getNombre())
                .apellido(user.getApellido())
                .build();
    }

}