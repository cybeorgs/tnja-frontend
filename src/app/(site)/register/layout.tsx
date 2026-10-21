import RegistrationLayout from "@/components/features/registers/RegistrationLayout";

// Kept mounted across /register/* so the type toggle animates between forms.
export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <RegistrationLayout>{children}</RegistrationLayout>;
}
