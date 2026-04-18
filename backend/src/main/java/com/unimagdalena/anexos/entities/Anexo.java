package com.unimagdalena.anexos.entities;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "anexos", indexes = {
        @Index(name = "idx_anexo_fecha_actualizacion", columnList = "fecha_actualizacion"),
        @Index(name = "idx_anexo_fecha_subida", columnList = "fecha_subida")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Anexo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nombre;

    @Column(name = "anio")
    private String anio;

    @Column(name = "categoria_principal", nullable = false)
    private String categoriaPrincipal;

    @Column(name = "categoria_secundaria", nullable = false)
    private String categoriaSecundaria;

    @Column(columnDefinition = "TEXT")
    private String descripcion;

    @Transient
    @JsonProperty("tieneArchivo")
    private Boolean tieneArchivo = false;

    public Boolean isTieneArchivo() { return tieneArchivo != null && tieneArchivo; }
    public void setTieneArchivo(Boolean tieneArchivo) { this.tieneArchivo = tieneArchivo != null && tieneArchivo; }

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "usuario_id", nullable = false)
    @JsonIgnoreProperties({
            "password",
            "authorities",
            "enabled",
            "accountNonExpired",
            "accountNonLocked",
            "credentialsNonExpired",
            "hibernateLazyInitializer",
            "handler",
            "anexos"
    })
    private Usuario usuario;

    @Column(name = "fecha_subida")
    private LocalDateTime fechaSubida;

    @Column(name = "fecha_actualizacion")
    private LocalDateTime fechaActualizacion;

    @Column(name = "contenido_texto", columnDefinition = "TEXT")
    private String contenidoTexto;

    @Column(name = "numero_anexo")
    private String numeroAnexo;

    @Column(name = "tipo_documento")
    private String tipoDocumento;

    @Column(name = "fuente")
    private String fuente;

    @PrePersist
    protected void onCreate() {
        fechaSubida = LocalDateTime.now();
        fechaActualizacion = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        fechaActualizacion = LocalDateTime.now();
    }
}