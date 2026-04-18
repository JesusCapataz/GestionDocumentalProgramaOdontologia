package com.unimagdalena.anexos.services;

import com.unimagdalena.anexos.entities.Anexo;
import com.unimagdalena.anexos.repositories.AnexoRepository;
import com.unimagdalena.anexos.exceptions.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.File;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AnexoService {

    private final AnexoRepository anexoRepository;
    private final String UPLOAD_DIR = "uploads/";

    public List<Anexo> obtenerTodos() {
        // Ordenamos por fecha de actualización DESC desde la BD para garantizar
        // que el filtro "Actualizados" siempre muestre primero los más recientes
        // independientemente de en qué página esté el usuario
        List<Anexo> anexos = anexoRepository
                .findAllByOrderByFechaActualizacionDescFechaSubidaDesc();
        anexos.forEach(this::verificarSiTieneArchivo);
        return anexos;
    }

    public Anexo obtenerPorId(Long id) {
        Anexo anexo = anexoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró el anexo con ID: " + id));
        verificarSiTieneArchivo(anexo);
        return anexo;
    }

    public Anexo guardarAnexo(Anexo anexo) {
        Anexo guardado = anexoRepository.save(anexo);
        verificarSiTieneArchivo(guardado);
        return guardado;
    }

    @org.springframework.transaction.annotation.Transactional
    public Anexo actualizarAnexo(Long id, Anexo anexoActualizado, boolean eliminarArchivo) {
        Anexo anexoViejo = anexoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró el anexo con ID: " + id));

        // 1. Solo actualizamos lo que el front puede cambiar
        anexoViejo.setNombre(anexoActualizado.getNombre());
        anexoViejo.setAnio(anexoActualizado.getAnio());
        anexoViejo.setCategoriaPrincipal(anexoActualizado.getCategoriaPrincipal());
        anexoViejo.setCategoriaSecundaria(anexoActualizado.getCategoriaSecundaria());
        anexoViejo.setDescripcion(anexoActualizado.getDescripcion());
        anexoViejo.setNumeroAnexo(anexoActualizado.getNumeroAnexo());
        anexoViejo.setTipoDocumento(anexoActualizado.getTipoDocumento());
        anexoViejo.setFuente(anexoActualizado.getFuente());

        // 2. Si el front mandó tieneArchivo = false, procedemos al borrado físico
        // 2. Si el front mandó eliminarArchivo = true, borramos el físico de Azure
        if (eliminarArchivo || !anexoActualizado.isTieneArchivo()) {
            eliminarArchivoFisicoInterno(id);
            anexoViejo.setContenidoTexto(null); // limpiamos el texto extraído también
        }

        // 3. Guardamos
        Anexo resultado = anexoRepository.save(anexoViejo);

        // 4. Sincronizamos la variable fantasma para la respuesta
        verificarSiTieneArchivo(resultado);
        return resultado;
    }

    public List<Anexo> obtenerActualizadosRecientemente() {
        LocalDateTime desde = LocalDateTime.now().minusDays(10);
        List<Anexo> anexos = anexoRepository
                .findByFechaActualizacionGreaterThanEqualOrFechaSubidaGreaterThanEqualOrderByFechaActualizacionDescFechaSubidaDesc(desde, desde);
        anexos.forEach(this::verificarSiTieneArchivo);
        return anexos;
    }

    public void eliminarAnexo(Long id) {
        Anexo anexo = obtenerPorId(id);
        anexoRepository.delete(anexo);
    }

    @org.springframework.transaction.annotation.Transactional
    public void actualizarContenidoTexto(Long id, String contenido) {
        Anexo anexo = anexoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró el anexo con ID: " + id));
        anexo.setContenidoTexto(contenido);
        anexoRepository.save(anexo);
    }
    // ====================================================================
    // MÉTODOS PRIVADOS DE ARCHIVOS FÍSICOS
    // ====================================================================

    private void verificarSiTieneArchivo(Anexo anexo) {
        anexo.setTieneArchivo(
                anexo.getContenidoTexto() != null && !anexo.getContenidoTexto().isBlank()
        );
    }

    private void eliminarArchivoFisicoInterno(Long id) {
        try {
            File dir = new File(UPLOAD_DIR);
            if (dir.exists()) {
                File[] files = dir.listFiles((d, name) -> name.startsWith(id + "."));
                if (files != null) for (File f : files) f.delete();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}