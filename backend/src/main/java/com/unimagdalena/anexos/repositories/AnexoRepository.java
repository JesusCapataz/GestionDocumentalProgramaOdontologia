package com.unimagdalena.anexos.repositories;

import com.unimagdalena.anexos.entities.Anexo;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface AnexoRepository extends JpaRepository<Anexo, Long> {
    List<Anexo> findByCategoriaPrincipal(String categoriaPrincipal);
    List<Anexo> findByAnio(String anio);

    // Ordenamiento global por fecha de actualización descendente
    // Spring Data genera: ORDER BY fecha_actualizacion DESC, fecha_subida DESC
    List<Anexo> findAllByOrderByFechaActualizacionDescFechaSubidaDesc();

    List<Anexo> findByFechaActualizacionGreaterThanEqualOrFechaSubidaGreaterThanEqualOrderByFechaActualizacionDescFechaSubidaDesc(
            LocalDateTime desdeActualizacion, LocalDateTime desdeSubida);
}