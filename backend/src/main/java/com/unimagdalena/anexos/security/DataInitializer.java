package com.unimagdalena.anexos.security; // Ajusta este paquete al tuyo

import com.unimagdalena.anexos.entities.Role;
import com.unimagdalena.anexos.entities.Usuario;
import com.unimagdalena.anexos.repositories.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    @org.springframework.beans.factory.annotation.Value("${app.superadmin1.email}")
    private String superAdmin1Email;

    @org.springframework.beans.factory.annotation.Value("${app.superadmin1.password}")
    private String superAdmin1Password;

    @org.springframework.beans.factory.annotation.Value("${app.superadmin2.email}")
    private String superAdmin2Email;

    @org.springframework.beans.factory.annotation.Value("${app.superadmin2.password}")
    private String superAdmin2Password;

    @Override
    public void run(String... args) throws Exception {

        crearSuperAdminSiNoExiste(
                superAdmin2Email,
                "Diana",
                "Escobar",
                superAdmin2Password,
                usuarioRepository,
                passwordEncoder
        );

        Optional<Usuario> usuarioExistente = usuarioRepository.findByCorreo(superAdmin1Email);

        if (usuarioExistente.isEmpty()) {
            Usuario root = Usuario.builder()
                    .nombre("Jesús")
                    .apellido("Capataz")
                    .correo(superAdmin1Email)
                    .password(passwordEncoder.encode(superAdmin1Password))
                    .rol(Role.SUPER_ADMIN)
                    .build();
            usuarioRepository.save(root);
            System.out.println("🛡️ INYECCIÓN EXITOSA: Cuenta Root creada para " + superAdmin1Email);
        } else {
            Usuario root = usuarioExistente.get();
            if (root.getRol() != Role.SUPER_ADMIN) {
                root.setRol(Role.SUPER_ADMIN);
                usuarioRepository.save(root);
                System.out.println("🛡️ ACTUALIZACIÓN EXITOSA: " + superAdmin1Email + " ascendido a SUPER_ADMIN");
            }
        }
    }

    private void crearSuperAdminSiNoExiste(
            String correo, String nombre, String apellido,
            String passwordPlano,
            com.unimagdalena.anexos.repositories.UsuarioRepository repo,
            org.springframework.security.crypto.password.PasswordEncoder encoder) {
        if (repo.findByCorreo(correo).isEmpty()) {
            repo.save(Usuario.builder()
                    .nombre(nombre).apellido(apellido)
                    .correo(correo)
                    .password(encoder.encode(passwordPlano))
                    .rol(Role.SUPER_ADMIN)
                    .build());
            System.out.println("🛡️ ROOT CREADO: " + correo);
        }
    }
}