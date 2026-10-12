"use client";

import React, { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, X, Loader2, Asterisk } from "lucide-react";
import Image from "next/image";

interface FileUploadProps {
  label: string;
  onChange: (url: string) => void;
  value?: string;
  accept?: string;
  helperText?: string;
  error?: string;
  layout?: "default" | "passport";
  required?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  label,
  onChange,
  value,
  accept = "image/*,application/pdf",
  helperText = "PNG, JPG, WEBP or PDF (Max 5MB)",
  error,
  layout = "default",
  required = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size exceeds the 5MB limit.");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";
      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to upload file");
      }

      // Trigger change callback with returned public URL
      onChange(data.url);
    } catch (err: any) {
      setUploadError(err.message || "An error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  const clearSelection = () => {
    onChange("");
    setUploadError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const triggerInput = () => {
    fileInputRef.current?.click();
  };

  const isPdf = value?.toLowerCase().endsWith(".pdf");

  return (
    <div className={`space-y-2 flex flex-col ${layout === "passport" ? "items-center" : ""}`}>
      <label className="flex items-center text-sm font-semibold text-gray-700">
        {label}
        {required && <Asterisk size={10} className="text-red-500 stroke-[4px] ml-0.5" />}
      </label>

      <div
        onClick={!value && !uploading ? triggerInput : undefined}
        className={`relative border-2 border-dashed flex flex-col items-center justify-center transition-all group ${
          layout === "passport" 
            ? "w-[140px] h-[180px] rounded-xl p-2" 
            : "w-full rounded-2xl p-5"
        } ${
          value
            ? (layout === "passport" ? "border-transparent" : "border-green-300 bg-green-50/20")
            : error || uploadError
            ? "border-red-300 bg-red-50/20"
            : "border-orange-200 hover:border-[#FF7400] bg-gray-50/50 hover:bg-orange-50/5 cursor-pointer"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading || !!value}
        />

        {uploading ? (
          // Uploading State
          <div className="flex flex-col items-center justify-center py-4 space-y-3 h-full w-full">
            <Loader2 className="w-8 h-8 text-[#FF7400] animate-spin" />
            <p className="text-xs font-medium text-gray-600 text-center">Uploading...</p>
          </div>
        ) : value ? (
          layout === "passport" ? (
            // Uploaded Successfully State for Passport Layout
            <div className="relative w-full h-full rounded-lg overflow-hidden border border-gray-200 shadow-sm">
              {isPdf ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                  <FileText size={40} className="text-red-500" />
                </div>
              ) : (
                <Image
                  src={value}
                  alt="Uploaded photo"
                  fill
                  className="object-cover"
                  unoptimized
                />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSelection();
                  }}
                  className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
                  title="Remove File"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          ) : (
            // Uploaded Successfully State for Default Layout
            <div className="relative w-full flex items-center justify-between p-2 rounded-xl bg-white border border-green-100 shadow-sm animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center space-x-3">
                {isPdf ? (
                  <div className="p-3 bg-red-50 text-red-500 rounded-xl">
                    <FileText size={24} />
                  </div>
                ) : (
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-100">
                    <Image
                      src={value}
                      alt="Uploaded thumbnail"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}

                <div className="text-left">
                  <span className="flex items-center text-xs font-bold text-green-600 gap-1 uppercase tracking-wider">
                    <CheckCircle size={12} /> Successfully Uploaded
                  </span>
                  <p className="text-xs text-gray-500 font-medium max-w-[220px] truncate mt-0.5">
                    {value.split("/").pop()}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearSelection();
                }}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors z-10 relative"
                title="Remove File"
              >
                <X size={18} />
              </button>
            </div>
          )
        ) : (
          // Default Upload Prompt
          <div className="flex flex-col items-center justify-center py-3 space-y-2 text-center h-full w-full">
            <div className="p-3 bg-orange-50 text-[#FF7400] rounded-full group-hover:scale-105 transition-transform duration-200">
              <Upload size={24} />
            </div>
            {layout === "passport" ? (
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-bold text-[#FF7400] hover:underline leading-tight">Upload Photo</span>
                <p className="text-[10px] text-gray-400 font-medium px-1 leading-tight">{helperText}</p>
              </div>
            ) : (
              <>
                <div>
                  <span className="text-sm font-bold text-[#FF7400] hover:underline">Click to upload</span>
                  <span className="text-sm text-gray-500 font-medium"> or drag and drop</span>
                </div>
                <p className="text-xs text-gray-400 font-medium">{helperText}</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error messages */}
      {(error || uploadError) && (
        <p className={`flex items-center gap-1.5 text-xs text-red-500 font-semibold mt-1 ${layout === "passport" ? "text-center justify-center" : ""}`}>
          <AlertCircle size={14} />
          {error || uploadError}
        </p>
      )}
    </div>
  );
};

export default FileUpload;
