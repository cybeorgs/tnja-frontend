"use client";

import React from "react";
import { Download } from "lucide-react";
import FileUpload from "@/components/common/FileUpload";

/** Every event banner must be exactly this size so cards and pages crop consistently. */
export const EVENT_BANNER_SIZE = { width: 1200, height: 600 };
export const EVENT_BANNER_TEMPLATE = "/templates/event-banner-template-1200x600.png";

interface EventBannerFieldProps {
  value: string;
  onChange: (url: string) => void;
}

export default function EventBannerField({ value, onChange }: EventBannerFieldProps) {
  const { width, height } = EVENT_BANNER_SIZE;
  return (
    <div className="space-y-2">
      <FileUpload
        label="Banner Image (Optional)"
        value={value}
        onChange={onChange}
        accept="image/png,image/jpeg,image/webp"
        dimensions={EVENT_BANNER_SIZE}
        helperText={`PNG, JPG or WEBP · exactly ${width} × ${height} px · max 5MB`}
      />
      <a
        href={EVENT_BANNER_TEMPLATE}
        download
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF7400] hover:underline"
      >
        <Download size={14} /> Download banner template ({width} × {height} px)
      </a>
    </div>
  );
}
