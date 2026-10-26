import CoachRegistrationForm from "@/components/features/registers/CoachRegistrationForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coach Registration | TNJA",
  description: "Register as a Coach with Tamil Nadu Judo Association.",
};

export default function CoachRegisterPage() {
  return <CoachRegistrationForm />;
}
