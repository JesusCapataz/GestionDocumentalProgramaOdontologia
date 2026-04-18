package com.unimagdalena.anexos.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final AuthenticationProvider authenticationProvider;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(request -> {
                    var config = new org.springframework.web.cors.CorsConfiguration();
                    config.setAllowedOrigins(java.util.List.of(
                            "http://localhost:4200",
                            "https://delightful-river-0e24c4810.1.azurestaticapps.net"
                    ));
                    config.setAllowedMethods(java.util.List.of("GET","POST","PUT","DELETE","OPTIONS"));
                    config.setAllowedHeaders(java.util.List.of("*"));
                    config.setAllowCredentials(true);
                    return config;
                }))
                .authorizeHttpRequests(auth -> auth
                        // 1. Permitimos el paso libre al login y registro
                        .requestMatchers("/api/auth/**").permitAll()

                        // 2. Usamos .hasRole() para que coincida con "ROLE_" + rol.name() de tu Entidad
                        .requestMatchers(HttpMethod.POST, "/api/anexos/**").hasAnyRole("ADMINISTRADOR", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/anexos/**").hasAnyRole("ADMINISTRADOR", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/anexos/**").hasAnyRole("ADMINISTRADOR", "SUPER_ADMIN")

                        // 3. Cualquier otra petición a anexos (como el GET) solo requiere estar logueado
                        .requestMatchers(HttpMethod.GET, "/api/anexos/**").authenticated()

                        // 4. Cualquier usuario autenticado puede gestionar su propia cuenta
                        .requestMatchers(HttpMethod.PUT, "/api/usuarios/perfil").authenticated()
                        .requestMatchers(HttpMethod.PUT, "/api/usuarios/password").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/usuarios/verificar-password").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/ia/consultar").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/usuarios/todos").hasRole("SUPER_ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/usuarios/*/rol").hasRole("SUPER_ADMIN")

                        // 5. El resto de la API también protegida
                        .anyRequest().authenticated()

                )
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authenticationProvider(authenticationProvider)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}