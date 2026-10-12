import React from 'react';
import PageHero from '@/components/common/PageHero';
import MemberCard from '@/components/features/MemberCard';

export default function ECMembersPage() {
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Executive Committee Members" }
  ];

  const title = (
    <>
      <span className="text-[#FF7400]">Executive</span> Committee <br />
      and <br />
      Honorary <span className="text-[#FF7400]">Members</span>
    </>
  );

  const members = [
    {
      name: "Vijaya Mohana Murali R",
      designation: "PRESIDENT",
      phone: "9841041112",
      email: "vmmurali@gmail.com",
      regId: "TNJA/CEC/REP-01/01",
      address: "6/154 Rathinavelu, Jothinagar, RA Puram, Chennai-600028",
      image: "/members/m1.png"
    },
    {
      name: "Murali Na",
      designation: "GENERAL SECRETARY",
      phone: "9841276527",
      email: "murali@tnja.com",
      regId: "TNJA/CEC/REP-01/02",
      address: "6/154 Rathinavelu, Jothinagar, RA Puram, Chennai-600028",
      image: "/members/m2.png"
    },
    {
      name: "Naveen G.V",
      designation: "VICE - PRESIDENT",
      phone: "9841212345",
      email: "naveen@gmail.com",
      regId: "TNJA/CEC/REP-01/03",
      address: "6/154 Rathinavelu, Jothinagar, RA Puram, Chennai-600028",
      image: "/members/m3.png"
    },
    {
      name: "Pushpanathan S",
      designation: "HON VICE PRESIDENT",
      phone: "9444141112",
      email: "pushpa@gmail.com",
      regId: "TNJA/CEC/REP-01/04",
      address: "6/154 Rathinavelu, Jothinagar, RA Puram, Chennai-600028",
      image: "/members/m4.png"
    },
    {
      name: "Venkatrangam K",
      designation: "TREASURER",
      phone: "9789123456",
      email: "venkat@gmail.com",
      regId: "TNJA/CEC/REP-01/05",
      address: "6/154 Rathinavelu, Jothinagar, RA Puram, Chennai-600028",
      image: "/members/m5.png"
    },
    {
      name: "Balachandar K",
      designation: "JOINT SECRETARY",
      phone: "9841345678",
      email: "bala@gmail.com",
      regId: "TNJA/CEC/REP-01/06",
      address: "6/154 Rathinavelu, Jothinagar, RA Puram, Chennai-600028",
      image: "/members/m6.png"
    },
    {
      name: "Prabu S",
      designation: "EC MEMBER",
      phone: "9841456789",
      email: "prabu@gmail.com",
      regId: "TNJA/CEC/REP-01/07",
      address: "6/154 Rathinavelu, Jothinagar, RA Puram, Chennai-600028",
      image: "/members/m7.png"
    },
    {
      name: "Gunasekaran RA",
      designation: "EC MEMBER",
      phone: "9841567890",
      email: "guna@gmail.com",
      regId: "TNJA/CEC/REP-01/08",
      address: "6/154 Rathinavelu, Jothinagar, RA Puram, Chennai-600028",
      image: "/members/m8.png"
    },
    {
      name: "Sarathy D",
      designation: "EC MEMBER",
      phone: "9841678901",
      email: "sarathy@gmail.com",
      regId: "TNJA/CEC/REP-01/09",
      address: "6/154 Rathinavelu, Jothinagar, RA Puram, Chennai-600028",
      image: "/members/m9.png"
    },
    {
      name: "Mohith Goriya R",
      designation: "EC MEMBER",
      phone: "9841789012",
      email: "mohith@gmail.com",
      regId: "TNJA/CEC/REP-01/10",
      address: "6/154 Rathinavelu, Jothinagar, RA Puram, Chennai-600028",
      image: "/members/m10.png"
    }
  ];

  return (
    <main className="min-h-screen bg-white">
      <PageHero 
        title={title}
        breadcrumbItems={breadcrumbItems}
        backgroundImage="/members/ec-hero.png"
      />
      
      {/* Page Content */}
      <section className="container mx-auto px-4 md:px-12 py-20">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-6 uppercase tracking-tight">
            Our Executive Committee
          </h2>
          <div className="w-24 h-1.5 bg-[#FF7400] mx-auto rounded-full mb-8"></div>
          <p className="text-slate-600 text-lg leading-relaxed font-medium">
            Meet the leadership team of the Tamil Nadu Judo Association. Our committee is composed of 
            distinguished individuals dedicated to promoting the sport of Judo and supporting our athletes across the region.
          </p>
        </div>
        
        {/* Member grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-14 max-w-7xl mx-auto">
          {members.map((member, index) => (
            <MemberCard key={index} {...member} />
          ))}
        </div>
      </section>
    </main>
  );
}
