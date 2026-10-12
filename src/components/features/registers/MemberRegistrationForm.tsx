"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/common/Button';
import { Check, Asterisk, User, Mail, Smartphone, MapPin, Calendar, Camera, FileText } from 'lucide-react';
import { MemberRegistrationData } from '@/types/registration';
import FileUpload from '@/components/common/FileUpload';

const RequiredSymbol = () => <Asterisk size={10} className="text-red-500 stroke-[4px]" />;

const SectionHeader = ({ title }: { title: string }) => (
  <div className="bg-[#F8F9FA] border border-[#E9ECEF] py-4 px-6 mb-8 rounded-sm">
    <h2 className="text-lg font-bold text-[#2B1300] tracking-tight">{title}</h2>
  </div>
);

const InputField = ({ label, name, placeholder, required = false, type = "text", icon: Icon, value, onChange, maxLength, disabled = false, autoComplete }: any) => (
  <div className="flex flex-col gap-2 w-full">
    <label className="text-xs font-bold text-gray-800 flex items-center gap-1">
      {label} {required && <RequiredSymbol />}
    </label>
    <div className="relative">
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        disabled={disabled}
        autoComplete={autoComplete}
        className={`w-full ${Icon ? 'pl-10' : 'px-4'} py-3 bg-white border border-[#DEE2E6] rounded text-sm text-gray-900 focus:outline-none focus:border-[#FF7400] focus:ring-1 focus:ring-[#FF7400]/20 transition-all placeholder:text-gray-400 ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`}
      />
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <Icon size={18} />
        </div>
      )}
    </div>
  </div>
);

const SelectField = ({ label, name, options, required = false, value, onChange }: any) => (
  <div className="flex flex-col gap-2 w-full">
    <label className="text-xs font-bold text-gray-800 flex items-center gap-1">
      {label} {required && <RequiredSymbol />}
    </label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      className="w-full px-4 py-3 bg-white border border-[#DEE2E6] rounded text-sm focus:outline-none focus:border-[#FF7400] focus:ring-1 focus:ring-[#FF7400]/20 transition-all text-gray-700"
    >
      <option value="">Select</option>
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const FileUploadField = ({ label, required = false, description, icon: Icon }: any) => (
  <div className="flex flex-col gap-2 w-full h-full">
    {label && (
      <label className="text-xs font-bold text-gray-800 flex items-center justify-center gap-1 mb-2">
        {label} {required && <RequiredSymbol />}
      </label>
    )}
    <div className="border-2 border-dashed border-[#DEE2E6] rounded-sm p-8 flex flex-col items-center justify-center text-center gap-3 bg-[#FCFCFC] hover:bg-[#F8F9FA] transition-colors cursor-pointer group h-full min-h-[180px]">
      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm border border-[#EEEEEE] group-hover:scale-110 transition-transform">
        {Icon ? <Icon size={24} className="text-gray-400" /> : <Camera size={24} className="text-gray-400" />}
      </div>
      <div>
        <p className="text-xs font-bold text-gray-600">Drag files to upload</p>
        <p className="text-[10px] text-gray-400">or</p>
        <p className="text-xs font-bold text-[#FF7400]">Choose File</p>
      </div>
    </div>
    {description && (
      <div className="mt-4 bg-[#D32F2F] text-white p-3 text-[10px] leading-relaxed font-medium">
        {description}
      </div>
    )}
  </div>
);

const DatePickerField = ({ label, name, required = false, value, onChange, placeholder = "DD/MM/YYYY", maxDate: maxDateProp }: any) => {
  let defaultMonth = new Date().getMonth();
  let defaultYear = new Date().getFullYear();
  if (value && value.includes('/')) {
    const parts = value.split('/');
    if (parts.length === 3) {
      defaultMonth = parseInt(parts[1]) - 1;
      defaultYear = parseInt(parts[2]);
    }
  } else if (maxDateProp) {
    defaultMonth = new Date(maxDateProp).getMonth();
    defaultYear = new Date(maxDateProp).getFullYear();
  }

  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(defaultMonth);
  const [currentYear, setCurrentYear] = useState(defaultYear);
  const [viewMode, setViewMode] = useState<'date' | 'year'>('date');
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    const clean = val.replace(/\D/g, '');
    let formatted = clean;
    if (clean.length > 2 && clean.length <= 4) {
      formatted = `${clean.slice(0, 2)}/${clean.slice(2)}`;
    } else if (clean.length > 4) {
      formatted = `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4, 8)}`;
    }
    onChange({ target: { name, value: formatted } });
  };

  const selectDate = (day: number) => {
    const formattedDay = day.toString().padStart(2, '0');
    const formattedMonth = (currentMonth + 1).toString().padStart(2, '0');
    const formattedDate = `${formattedDay}/${formattedMonth}/${currentYear}`;
    onChange({ target: { name, value: formattedDate } });
    setIsOpen(false);
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const startYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => startYear - i);

  return (
    <div className="flex flex-col gap-2 w-full relative" ref={containerRef}>
      <label className="text-xs font-bold text-gray-800 flex items-center gap-1">
        {label} {required && <RequiredSymbol />}
      </label>
      <div className="relative">
        <input
          type="text"
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={handleTextChange}
          maxLength={10}
          onClick={() => setIsOpen(true)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-[#DEE2E6] rounded text-sm text-gray-900 focus:outline-none focus:border-[#FF7400] focus:ring-1 focus:ring-[#FF7400]/20 transition-all placeholder:text-gray-400"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
          <Calendar size={18} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-[100%] left-0 z-50 mt-2 p-4 bg-white text-gray-900 border border-[#DEE2E6] rounded-xl shadow-xl w-[300px] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center gap-2 mb-4">
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
              className="px-3 py-1.5 bg-white border border-[#DEE2E6] rounded-lg text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#FF7400] flex-grow text-gray-700 cursor-pointer"
            >
              {months.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'date' ? 'year' : 'date')}
              className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 transition-colors rounded-lg text-sm font-bold text-gray-800 flex items-center gap-2"
            >
              {currentYear} 
              <span className="text-[10px]">{viewMode === 'year' ? '▲' : '▼'}</span>
            </button>
          </div>

          {viewMode === 'date' ? (
            <>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wider">
                <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {Array.from({ length: firstDayIndex }).map((_, idx) => (
                  <div key={`empty-${idx}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const day = idx + 1;
                  const formattedDay = day.toString().padStart(2, '0');
                  const formattedMonth = (currentMonth + 1).toString().padStart(2, '0');
                  const isSelected = value === `${formattedDay}/${formattedMonth}/${currentYear}`;
                  const currentDate = new Date(currentYear, currentMonth, day);
                  
                  // We'll set maxDate to restrict future dates, using maxDateProp if provided
                  const maxDate = maxDateProp || new Date();
                  maxDate.setHours(23, 59, 59, 999);
                  
                  const isDisabled = currentDate > maxDate;

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => !isDisabled && selectDate(day)}
                      disabled={isDisabled}
                      className={`py-2 rounded-full transition-colors font-medium ${
                        isDisabled 
                          ? 'opacity-30 cursor-not-allowed text-gray-400' 
                          : 'hover:bg-orange-50 hover:text-[#FF7400] text-gray-700'
                      } ${isSelected && !isDisabled ? 'bg-[#FF7400] text-white hover:bg-[#FF7400] hover:text-white font-bold' : ''}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-4 gap-2 h-[220px] overflow-y-auto pr-2 custom-scrollbar scroll-smooth">
              <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f9fafb; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
              `}} />
              {/* Reverse to show chronological order (2016, 2017, ...) */}
              {[...years].reverse().map(y => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setCurrentYear(y);
                    setViewMode('date');
                  }}
                  className={`py-2 text-sm rounded-full transition-all ${
                    y === currentYear 
                      ? 'bg-[#FF7400] text-white font-black shadow-lg shadow-[#FF7400]/30' 
                      : 'text-gray-700 hover:bg-gray-100 font-medium'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MemberRegistrationForm = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  
  const [districts, setDistricts] = useState<{id: string, name: string}[]>([]);
  const [taluks, setTaluks] = useState<{id: string, name: string}[]>([]);

  const [formData, setFormData] = useState<MemberRegistrationData>({
    districtId: '',
    talukId: '',
    taluk: '',
    pincode: '',
    fullName: '',
    fatherName: '',
    dob: '',
    bloodGroup: '',
    gender: '',
    addressLine1: '',
    addressLine2: '',
    addressPincode: '',
    city: '',
    mobileNumber: '',
    alternateMobileNumber: '',
    email: '',
    aadhaarNumber: '',
    employmentType: '',
    companyName: '',
    designation: '',
    profilePhoto: '',
    nationality: '',
    agreedToTerms: false
  });

  useEffect(() => {

    const fetchData = async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api';
      try {
        const response = await fetch(`${apiUrl}/districts`);
        if (response.ok) setDistricts(await response.json());
      } catch (err) {
        console.error("Failed to fetch districts:", err);
      }
    };
    fetchData();
  }, []);





  const handleDistrictChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const districtId = e.target.value;
    setFormData(prev => ({ ...prev, districtId, talukId: '', taluk: '' }));
    setTaluks([]);
    
    if (districtId) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api';
      try {
        const response = await fetch(`${apiUrl}/districts/${districtId}/taluks`);
        if (response.ok) {
          setTaluks(await response.json());
        }
      } catch (err) {
        console.error("Failed to fetch taluks:", err);
      }
    }
  };

  const handleTalukChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const talukId = e.target.value;
    const selectedTaluk = taluks.find(t => t.id === talukId);
    
    if (selectedTaluk) {
      setFormData(prev => ({ 
        ...prev, 
        talukId,
        taluk: selectedTaluk.name
      }));
    } else {
      setFormData(prev => ({ ...prev, talukId: '', taluk: '' }));
    }
  };

  const handleSendOtp = async () => {
    if (!formData.aadhaarNumber || formData.aadhaarNumber.length !== 12) {
      setOtpError("Please enter a valid 12-digit Aadhaar Number.");
      return;
    }
    if (!formData.email) {
      setOtpError("Please enter your Email Address first to receive the OTP.");
      return;
    }
    setOtpLoading(true);
    setOtpError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api';
      const res = await fetch(`${apiUrl}/auth/send-aadhaar-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaarNumber: formData.aadhaarNumber, email: formData.email })
      });
      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
        setOtpError(null);
      } else {
        setOtpError(data.error || "Failed to send OTP.");
      }
    } catch (err) {
      setOtpError("Failed to connect to server.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpValue || otpValue.length !== 6) {
      setOtpError("Please enter a valid 6-digit OTP.");
      return;
    }
    setOtpLoading(true);
    setOtpError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api';
      const res = await fetch(`${apiUrl}/auth/verify-aadhaar-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaarNumber: formData.aadhaarNumber, otp: otpValue })
      });
      const data = await res.json();
      if (res.ok) {
        setOtpVerified(true);
        setOtpError(null);
      } else {
        setOtpError(data.error || "Failed to verify OTP.");
      }
    } catch (err) {
      setOtpError("Failed to connect to server.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'dob') {
      const clean = value.replace(/\D/g, '');
      let formatted = clean;
      if (clean.length > 2 && clean.length <= 4) {
        formatted = `${clean.slice(0, 2)}/${clean.slice(2)}`;
      } else if (clean.length > 4) {
        formatted = `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4, 8)}`;
      }
      setFormData(prev => ({ ...prev, dob: formatted }));
    } else {
      const numberFields = ['mobileNumber', 'alternateMobileNumber', 'pincode', 'addressPincode', 'aadhaarNumber', 'whatsappNumber'];
      if (numberFields.includes(name)) {
        setFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '') }));
      } else if (name === 'email') {
        setFormData(prev => ({ ...prev, [name]: value.replace(/[^a-zA-Z0-9@._-]/g, '') }));
      } else if (['fullName', 'fatherName', 'city', 'state', 'nationality'].includes(name)) {
        setFormData(prev => ({ ...prev, [name]: value.replace(/[^a-zA-Z\s.'-]/g, '') }));
      } else if (['address', 'addressLine1', 'addressLine2'].includes(name)) {
        setFormData(prev => ({ ...prev, [name]: value.replace(/[^a-zA-Z0-9\s,.'\/-]/g, '') }));
      } else {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.profilePhoto) {
      setError("Please upload your photo.");
      return;
    }
    if (!formData.agreedToTerms) {
      setError("Please agree to the Terms and Privacy policy.");
      return;
    }

    const emailRegex = /^(?=.{1,254}$)(?=.{1,64}@)[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address (e.g., max 64 characters before @).");
      return;
    }
    if (!otpVerified) {
      setError("Please verify your Aadhaar Number before submitting.");
      return;
    }

    setLoading(true);
    setError(null);

    // Format dob from DD/MM/YYYY to YYYY-MM-DD for backend compatibility
    const apiDob = formData.dob && formData.dob.includes('/') 
      ? formData.dob.split('/').reverse().join('-') 
      : formData.dob;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api';
      const response = await fetch(`${apiUrl}/register/member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          dob: apiDob
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(result);
      } else {
        setError(result.error || "Something went wrong");
      }
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-[800px] mx-auto p-12 text-center bg-white border border-[#DEE2E6] rounded-sm shadow-xl mt-10">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="text-green-600" size={40} />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Registration Submitted!</h2>
        <p className="text-gray-600 mb-8">Your member application has been submitted and is currently <strong>awaiting admin approval</strong>.</p>
        
        <div className="bg-[#F8F9FA] p-6 rounded-lg mb-8 border border-[#E9ECEF]">
          <p className="text-sm text-gray-500 uppercase font-bold tracking-wider mb-2">Your Temporary Member ID</p>
          <p className="text-4xl font-mono font-bold text-[#FF7400]">{success.tempId || 'PENDING'}</p>
        </div>

        <div className="text-left space-y-4 bg-orange-50/50 p-6 rounded-lg border border-orange-100 mb-8">
          <h4 className="font-bold text-[#FF7400]">Next Steps:</h4>
          <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
            <li><strong>Admin Review:</strong> Our team will review your member registration details.</li>
            <li><strong>Payment Email:</strong> Once approved, a **payment link/method** will be sent to your registered email address.</li>
            <li><strong>Member ID Email:</strong> After your payment is verified, your **Member ID** will be generated and sent to you via email to activate your account.</li>
          </ul>
        </div>

        <p className="text-sm text-gray-600">
          A confirmation email has been sent to <strong>{formData.email}</strong>. Use your Temporary Member ID to track your application status.
        </p>

        <div className="flex gap-4 justify-center mt-10">
          <Button
            variant="outline"
            href="/"
          >
            Back to Home
          </Button>
          <Button
            variant="primary"
            href={`/track?tempId=${success.tempId}`}
          >
            Track Status & Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto py-10 px-4 lg:px-6">
      <form onSubmit={handleSubmit}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-12"
        >
          
          <section className="bg-white border border-[#DEE2E6] rounded-sm overflow-hidden">
            <SectionHeader title="Residing Location " />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 pt-2">
              <SelectField 
                label="Select Your District" 
                name="districtId" 
                required 
                options={districts.map(d => ({ label: d.name, value: d.id }))}
                value={formData.districtId}
                onChange={handleDistrictChange}
              />
              <SelectField 
                label="Select Your Taluk" 
                name="talukId" 
                required 
                options={taluks.map(t => ({ label: t.name, value: t.id }))}
                value={formData.talukId}
                onChange={handleTalukChange}
              />
              <InputField 
                label="Pincode" 
                name="pincode" 
                placeholder="6 Digit Pincode" 
                required 
                maxLength={6}
                value={formData.pincode}
                onChange={handleInputChange}
                autoComplete="off"
              />
            </div>
          </section>

          {/* Personal Information */}
          <section className="bg-white border border-[#DEE2E6] rounded-sm overflow-hidden">
            <SectionHeader title="Personal Information" />
            <div className="p-8 pt-2">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column Fields */}
                <div className="lg:col-span-8 space-y-8">
                  <InputField 
                    label="Enter your Name" 
                    name="fullName" 
                    placeholder="Member Name" 
                    required 
                    value={formData.fullName}
                    onChange={handleInputChange}
                  />
                  <InputField 
                    label="Father's Name" 
                    name="fatherName" 
                    placeholder="Father's Name" 
                    required 
                    value={formData.fatherName}
                    onChange={handleInputChange}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
                    <DatePickerField 
                      label="Date of Birth" 
                      name="dob" 
                      required 
                      value={formData.dob} 
                      onChange={handleInputChange} 
                      maxDate={new Date(new Date().setFullYear(new Date().getFullYear() - 18))}
                    />
                  </div>
                </div>

                {/* Right Column Photo Upload */}
                <div className="lg:col-span-4 h-full">
                  <FileUpload
                    label="Photo"
                    required
                    value={formData.profilePhoto}
                    onChange={(url) => setFormData(prev => ({ ...prev, profilePhoto: url }))}
                    accept="image/*"
                    helperText="JPG, PNG, WEBP (Max 5MB)"
                    layout="passport"
                  />
                </div>

                {/* Full Width Fields Below */}
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <SelectField 
                    label="Blood Group" 
                    name="bloodGroup" 
                    required 
                    options={[
                      { label: "O+ve", value: "O+ve" },
                      { label: "O-ve", value: "O-ve" },
                      { label: "A+ve", value: "A+ve" },
                      { label: "A-ve", value: "A-ve" },
                      { label: "B+ve", value: "B+ve" },
                      { label: "B-ve", value: "B-ve" },
                      { label: "AB+ve", value: "AB+ve" },
                      { label: "AB-ve", value: "AB-ve" }
                    ]}
                    value={formData.bloodGroup}
                    onChange={handleInputChange}
                  />
                  <SelectField 
                    label="Gender" 
                    name="gender" 
                    required 
                    options={[
                      { label: "Male", value: "MALE" },
                      { label: "Female", value: "FEMALE" },
                      { label: "Other", value: "OTHER" }
                    ]}
                    value={formData.gender}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <InputField 
                    label="Mobile Number" 
                    name="mobileNumber" 
                    placeholder="Enter Your Mobile" 
                    required 
                    icon={Smartphone}
                    maxLength={10}
                    value={formData.mobileNumber}
                    onChange={handleInputChange}
                  />
                  <InputField 
                    label="Alternate Mobile" 
                    name="alternateMobileNumber" 
                    placeholder="Enter Alternate Mobile" 
                    maxLength={10}
                    value={formData.alternateMobileNumber}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <InputField 
                    label="Email ID" 
                    name="email" 
                    type="email"
                    placeholder="Enter Your Email ID" 
                    required 
                    icon={Mail}
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={otpVerified}
                  />
                  <InputField
                    label="Nationality"
                    name="nationality"
                    placeholder="Enter Nationality"
                    required
                    value={formData.nationality}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="lg:col-span-12">
                  <div className="flex flex-col gap-2 w-full">
                    <label className="text-xs font-bold text-gray-800 flex items-center gap-1">
                      Aadhar Number <RequiredSymbol />
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="aadhaarNumber"
                        placeholder="12 Digit Aadhar"
                        maxLength={12}
                        value={formData.aadhaarNumber}
                        onChange={handleInputChange}
                        disabled={otpVerified}
                        className={`w-full px-4 py-3 bg-white border border-[#DEE2E6] rounded text-sm text-gray-900 focus:outline-none focus:border-[#FF7400] focus:ring-1 focus:ring-[#FF7400]/20 transition-all placeholder:text-gray-400 ${otpVerified ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`}
                      />
                      {!otpVerified ? (
                        <Button 
                          type="button" 
                          variant="primary" 
                          onClick={handleSendOtp} 
                          disabled={otpLoading || formData.aadhaarNumber.length !== 12 || !formData.email}
                          className="whitespace-nowrap px-6"
                        >
                          {otpLoading && !otpSent ? 'Sending...' : otpSent ? 'Resend OTP' : 'Verify'}
                        </Button>
                      ) : (
                        <div className="flex items-center justify-center px-4 bg-green-50 border border-green-200 text-green-600 rounded whitespace-nowrap font-bold text-sm">
                          <Check size={16} className="mr-1" /> Verified
                        </div>
                      )}
                    </div>
                    {otpError && <p className="text-red-500 text-xs font-medium">{otpError}</p>}
                    
                    {otpSent && !otpVerified && (
                      <div className="mt-2 p-4 bg-blue-50 border border-blue-100 rounded flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <p className="text-xs text-blue-800 font-medium">An OTP has been sent to your email <strong>{formData.email}</strong>.</p>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Enter 6-digit OTP" 
                            maxLength={6}
                            value={otpValue}
                            onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-3 py-2 bg-white border border-blue-200 rounded text-sm focus:outline-none focus:border-blue-500"
                          />
                          <Button 
                            type="button" 
                            variant="primary" 
                            onClick={handleVerifyOtp}
                            disabled={otpLoading || otpValue.length !== 6}
                            className="whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                          >
                            {otpLoading ? 'Verifying...' : 'verify'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Address Information */}
          <section className="bg-white border border-[#DEE2E6] rounded-sm overflow-hidden shadow-sm">
            <SectionHeader title="Permanent Address Information" />
            <div className="p-8 pt-2 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InputField 
                  label="Address Line 1" 
                  name="addressLine1" 
                  placeholder="Enter Address Line 1" 
                  required 
                  value={formData.addressLine1}
                  onChange={handleInputChange}
                />
                <InputField 
                  label="Address Line 2" 
                  name="addressLine2" 
                  placeholder="Enter Address Line 2" 
                  value={formData.addressLine2}
                  onChange={handleInputChange}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InputField 
                  label="City" 
                  name="city" 
                  placeholder="Search City" 
                  required 
                  value={formData.city}
                  onChange={handleInputChange}
                />
                <InputField 
                  label="Pincode" 
                  name="addressPincode" 
                  placeholder="6 Digit Pincode" 
                  required 
                  maxLength={6}
                  value={formData.addressPincode}
                  onChange={handleInputChange}
                  autoComplete="off"
                />
              </div>
            </div>
          </section>

          {/* Professional Information */}
          <section className="bg-white border border-[#DEE2E6] rounded-sm overflow-hidden">
            <SectionHeader title="Professional Information (Optional)" />
            <div className="p-8 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <SelectField 
                  label="Sector" 
                  name="employmentType" 
                  options={[
                    { label: "Government", value: "GOVERNMENT" },
                    { label: "Private", value: "PRIVATE" },
                    { label: "Self Employment", value: "SELF_EMPLOYED" }
                  ]}
                  value={formData.employmentType}
                  onChange={handleInputChange}
                />
              </div>

              {formData.employmentType === 'GOVERNMENT' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-2 duration-300">
                  <InputField 
                    label="Department Name" 
                    name="companyName" 
                    placeholder="Enter Department Name" 
                    required 
                    value={formData.companyName}
                    onChange={handleInputChange}
                  />
                  <InputField 
                    label="Designation" 
                    name="designation" 
                    placeholder="Enter Designation" 
                    required 
                    value={formData.designation}
                    onChange={handleInputChange}
                  />
                </div>
              )}

              {formData.employmentType === 'PRIVATE' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-2 duration-300">
                  <InputField 
                    label="Company Name" 
                    name="companyName" 
                    placeholder="Enter Company Name" 
                    required 
                    value={formData.companyName}
                    onChange={handleInputChange}
                  />
                  <InputField 
                    label="Designation" 
                    name="designation" 
                    placeholder="Enter Designation" 
                    required 
                    value={formData.designation}
                    onChange={handleInputChange}
                  />
                </div>
              )}

              {formData.employmentType === 'SELF_EMPLOYED' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-2 duration-300">
                  <InputField 
                    label="Nature of Business" 
                    name="companyName" 
                    placeholder="Enter Nature of Business" 
                    required 
                    value={formData.companyName}
                    onChange={handleInputChange}
                  />
                </div>
              )}
            </div>
          </section>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-sm text-sm font-medium"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Actions */}
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  id="agreedToTerms" 
                  name="agreedToTerms"
                  checked={formData.agreedToTerms}
                  onChange={handleInputChange}
                  className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-[#DEE2E6] bg-white transition-all checked:bg-[#FF7400] checked:border-[#FF7400]"
                />
                <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                  <Check size={12} strokeWidth={4} />
                </span>
              </div>
              <label htmlFor="agreedToTerms" className="text-[11px] text-gray-500">
                I agree to the <span className="text-[#FF7400] font-bold">Terms and Privacy policy</span>
              </label>
            </div>
            
            <Button 
              type="submit"
              variant="primary"
              size="lg"
              className="w-40 rounded-full text-xs font-bold py-4"
              disabled={loading}
            >
              {loading ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </motion.div>
      </form>
    </div>
  );
};

export default MemberRegistrationForm;
