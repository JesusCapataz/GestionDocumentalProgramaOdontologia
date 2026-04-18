// ── UsuarioResumenDTO.java ────────────────────────────────────
package com.unimagdalena.anexos.dto;

import com.unimagdalena.anexos.entities.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UsuarioResumenDTO {
    private Long   id;
    private String nombre;
    private String apellido;
    private String correo;
    private Role   rol;
}