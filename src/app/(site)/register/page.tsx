import { redirect } from "next/navigation";

// Registration opens straight on the player form; the toggle on that page switches to the other types.
export default function RegisterPage() {
  redirect("/register/player");
}
