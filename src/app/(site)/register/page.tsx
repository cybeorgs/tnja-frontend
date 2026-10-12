import RegisterSelection from "@/components/features/RegisterSelection";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Registration | TNJA",
  description: "Select your role to create a new account with Tamil Nadu Judo Association.",
};

export default function RegisterPage() {
  return (
    <main>
      <RegisterSelection />
    </main>
  );
}
