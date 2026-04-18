// ── RolUpdateRequest.java ─────────────────────────────────────
package com.unimagdalena.anexos.dto;

import com.unimagdalena.anexos.entities.Role;
import lombok.Data;

@Data
public class RolUpdateRequest {
    private Role nuevoRol;
}