"use client";

import { useState } from "react";
import { SimpleSelect } from "@/components/ui/select";

/** Wraps SimpleSelect with a hidden input for native form submission */
export function FormSelect({
  name,
  defaultValue,
  options,
  placeholder,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <SimpleSelect
        value={value}
        onValueChange={(val) => setValue(val === "__all__" ? "" : val)}
        options={[{ value: "__all__", label: placeholder }, ...options]}
        placeholder={placeholder}
      />
    </>
  );
}
