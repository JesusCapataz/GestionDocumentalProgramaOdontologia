package com.unimagdalena.anexos.services;

import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;

@Service
public class AzureBlobService {

    private final BlobContainerClient containerClient;

    public AzureBlobService(
            @Value("${azure.storage.connection-string}") String connectionString,
            @Value("${azure.storage.container-name}") String containerName) {

        BlobServiceClient serviceClient = new BlobServiceClientBuilder()
                .connectionString(connectionString)
                .buildClient();

        this.containerClient = serviceClient.getBlobContainerClient(containerName);

        // Crea el contenedor si no existe
        if (!this.containerClient.exists()) {
            this.containerClient.create();
        }
    }

    // Sube un archivo y devuelve su URL pública
    public String subirArchivo(String nombreBlob, MultipartFile file) {
        try {
            BlobClient blobClient = containerClient.getBlobClient(nombreBlob);
            blobClient.upload(file.getInputStream(), file.getSize(), true);
            return blobClient.getBlobUrl(); // URL pública del archivo
        } catch (Exception e) {
            throw new RuntimeException("Error subiendo archivo a Azure: " + e.getMessage());
        }
    }

    // Descarga un archivo como stream
    public InputStream descargarArchivo(String nombreBlob) {
        BlobClient blobClient = containerClient.getBlobClient(nombreBlob);
        if (!blobClient.exists()) return null;
        return blobClient.openInputStream();
    }

    // Verifica si existe un archivo
    public boolean existeArchivo(String nombreBlob) {
        return containerClient.getBlobClient(nombreBlob).exists();
    }

    // Borra un archivo
    public void borrarArchivo(String nombreBlob) {
        BlobClient blobClient = containerClient.getBlobClient(nombreBlob);
        if (blobClient.exists()) {
            blobClient.delete();
        }
    }

    // Busca el nombre del blob de un anexo (puede ser .pdf, .docx, etc.)
    public String encontrarNombreBlob(Long id) {
        String[] extensiones = {"pdf", "docx", "doc", "xlsx", "xls", "pptx", "txt"};
        for (String ext : extensiones) {
            String nombre = id + "." + ext;
            if (containerClient.getBlobClient(nombre).exists()) {
                return nombre;
            }
        }
        return null;
    }
}