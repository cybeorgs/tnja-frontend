import PlayerRegistrationForm from "@/components/features/registers/PlayerRegistrationForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Player Registration | TNJA",
  description: "Register as a player with Tamil Nadu Judo Association.",
};

export default function PlayerRegisterPage() {
  return <PlayerRegistrationForm />;
}
