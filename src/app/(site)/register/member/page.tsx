import MemberRegistrationForm from "@/components/features/registers/MemberRegistrationForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Administrative Member Registration | TNJA",
  description: "Register as an Administrative Member with Tamil Nadu Judo Association.",
};

export default function MemberRegisterPage() {
  return <MemberRegistrationForm />;
}
