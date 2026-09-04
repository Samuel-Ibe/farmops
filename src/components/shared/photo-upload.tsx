"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PhotoUploadProps {
  currentImage?: string | null;
  entityType: "inventory" | "farm" | "batch" | "supplier" | "warehouse";
  entityId?: string;
  onUpload: (url: string) => void;
  onError?: (error: string) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PhotoUpload({
  currentImage,
  entityType,
  entityId,
  onUpload,
  onError,
  size = "md",
  className = "",
}: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: "h-16 w-16",
    md: "h-32 w-32",
    lg: "h-48 w-48",
  };

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        onError?.("Please select an image file");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        onError?.("File too large. Maximum 5MB");
        return;
      }

      // Show local preview immediately
      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("entityType", entityType);
        formData.append("entityId", entityId || "general");

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Upload failed");
        }

        const data = await res.json();
        // Clean up local preview and use server URL
        URL.revokeObjectURL(localPreview);
        setPreview(data.url);
        onUpload(data.url);
      } catch (err: any) {
        URL.revokeObjectURL(localPreview);
        setPreview(currentImage || null);
        onError?.(err.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [currentImage, entityType, entityId, onUpload, onError]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemove = () => {
    setPreview(null);
    onUpload("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {preview ? (
        <div className={`relative ${sizeClasses[size]} rounded-lg overflow-hidden border`}>
          <img
            src={preview}
            alt="Uploaded"
            className="h-full w-full object-cover"
          />
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          )}
          {!uploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-1 right-1 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`${sizeClasses[size]} rounded-lg border-2 border-dashed cursor-pointer flex flex-col items-center justify-center gap-1 transition-colors ${
            dragOver
              ? "border-green-500 bg-green-50 dark:bg-green-950"
              : "border-muted-foreground/25 hover:border-green-400 hover:bg-muted"
          }`}
        >
          {size === "sm" ? (
            <Camera className="h-4 w-4 text-muted-foreground" />
          ) : (
            <>
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground text-center px-1">
                {uploading ? "Uploading..." : "Click or drag"}
              </span>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
