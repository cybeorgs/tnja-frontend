import MemberRegistrationForm from "@/components/features/registers/MemberRegistrationForm";
import { Metadata } from "next";
import Breadcrumb from "@/components/common/Breadcrumb";

export const metadata: Metadata = {
  title: "Member Registration | TNJA",
  description: "Register as a member with Tamil Nadu Judo Association.",
};

export default function MemberRegisterPage() {
  return (
    <main className="bg-white min-h-screen pb-20">
      {/* Banner Section */}
      <section className="bg-[#F6F6F6] relative overflow-hidden h-[150px] flex items-center mb-16">
        <div className="max-w-[1200px] mx-auto w-full px-4 relative z-10">
          <h1 className="text-[32px] font-bold text-[#1A1A1A] mb-2 tracking-tight">
            New Registration
          </h1>
          
          <Breadcrumb 
            items={[
              { label: "Home", href: "/" },
              { label: "Registration", href: "/register" },
              { label: "Registration as Member" }
            ]} 
          />
        </div>
      </section>

      {/* Form Header Section */}
      <div className="max-w-[1200px] mx-auto px-4 mb-10">
        <div className="text-center">
          <p className="text-[#FF7400] font-bold uppercase tracking-[0.25em] text-[11px] mb-4">
            New Registration
          </p>
          <h2 className="text-4xl md:text-[42px] font-bold text-[#1A1A1A] tracking-tight leading-none">
            New Members Registration Form
          </h2>
        </div>
      </div>

      <MemberRegistrationForm />
    </main>
  );
}
