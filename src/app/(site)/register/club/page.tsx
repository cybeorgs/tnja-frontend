import ClubRegistrationForm from "@/components/features/registers/ClubRegistrationForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Club Registration | TNJA",
  description: "Register your club with Tamil Nadu Judo Association.",
};

export default function ClubRegisterPage() {
  return <ClubRegistrationForm />;
}
