package com.unimagdalena.anexos.controllers;

import com.unimagdalena.anexos.dto.AuthResponse;
import com.unimagdalena.anexos.dto.LoginRequest;
import com.unimagdalena.anexos.dto.RegisterRequest;
import com.unimagdalena.anexos.services.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = {"http://localhost:4200", "https://delightful-river-0e24c4810.1.azurestaticapps.net"})
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }
}