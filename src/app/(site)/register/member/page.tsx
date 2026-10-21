import MemberRegistrationForm from "@/components/features/registers/MemberRegistrationForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Member Registration | TNJA",
  description: "Register as a member with Tamil Nadu Judo Association.",
};

export default function MemberRegisterPage() {
  return <MemberRegistrationForm />;
}
