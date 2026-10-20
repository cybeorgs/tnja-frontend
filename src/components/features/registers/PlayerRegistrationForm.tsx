"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/common/Button';
import { Search, Check, Asterisk, User, Mail, Smartphone, MapPin, GraduationCap, Calendar } from 'lucide-react';
import { PlayerRegistrationData } from '@/types/registration';
import FileUpload from '@/components/common/FileUpload';
import { useAadhaarDigilocker } from './useAadhaarDigilocker';
import OtpVerificationField, { useOtpVerification } from './OtpVerificationField';

const RequiredSymbol = () => <Asterisk size={10} className="text-red-500 stroke-[4px]" />;

const SectionHeader = ({ title }: { title: string }) => (
  <div className="bg-[#F8F9FA] border border-[#E9ECEF] py-4 px-6 mb-8 rounded-sm">
    <h2 className="text-lg font-bold text-[#2B1300] tracking-tight">{title}</h2>
  </div>
);

const InputField = ({ label, name, placeholder, required = false, type = "text", icon: Icon, value, onChange, maxLength, min, disabled = false, autoComplete }: any) => (
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
        min={min}
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

const PlayerRegistrationForm = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const aadhaar = useAadhaarDigilocker();
  const emailOtp = useOtpVerification('email');
  const mobileOtp = useOtpVerification('mobile');

  const [districts, setDistricts] = useState<{ id: string, name: string }[]>([]);
  const [taluks, setTaluks] = useState<{ id: string, name: string }[]>([]);
  const [clubs, setClubs] = useState<{ id: string, name: string, email: string, mobileNumber: string, tempId?: string, permanentId?: string }[]>([]);
  const [coaches, setCoaches] = useState<{ id: string, fullName: string, email: string, mobileNumber: string, tempId?: string, permanentId?: string }[]>([]);
  const [academyType, setAcademyType] = useState<"CLUB" | "COACH" | "NONE">("NONE");
  const [clubSearchId, setClubSearchId] = useState("");
  const [coachSearchId, setCoachSearchId] = useState("");

  const [formData, setFormData] = useState<PlayerRegistrationData>({
    districtId: '',
    talukId: '',
    taluk: '',
    pincode: '',
    fullName: '',
    gender: '',
    dob: '',
    age: 0,
    bloodGroup: '',
    mobileNumber: '',
    alternateMobileNumber: '',
    email: '',
    aadhaarNumber: '',
    address: '',
    city: '',
    state: 'Tamil Nadu',
    addressPincode: '',
    nationality: 'Indian',
    annualIncome: '',
    isBPL: false,
    institutionType: 'SCHOOL',
    degreeDepartment: '',
    clubId: '',
    coachId: '',
    schoolName: '',
    grade: '',
    areaOfInterest: '',
    areaOfStudy: '',
    preferLocation: '',
    profilePhoto: '',
    incomeProof: '',
    bplProof: '',
    agreedToTerms: false
  });

  useEffect(() => {

    const fetchData = async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api';
      try {
        const response = await fetch(`${apiUrl}/districts`);
        if (response.ok) setDistricts(await response.json());
      } catch (err) {
        console.error("Failed to fetch initial data:", err);
      }
    };
    fetchData();
  }, []);





  const selectDistrict = async (districtId: string, preselectTaluk?: { id: string, name: string }) => {
    setFormData(prev => ({
      ...prev,
      districtId,
      talukId: preselectTaluk?.id ?? '',
      taluk: preselectTaluk?.name ?? '',
      coachId: '',
      clubId: ''
    }));
    setTaluks([]);
    setCoaches([]);
    setClubs([]);

    if (districtId) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api';
      try {
        const [talukRes, coachRes, clubRes] = await Promise.all([
          fetch(`${apiUrl}/districts/${districtId}/taluks`),
          fetch(`${apiUrl}/coaches?districtId=${districtId}`),
          fetch(`${apiUrl}/clubs?districtId=${districtId}`)
        ]);
        if (talukRes.ok) setTaluks(await talukRes.json());
        if (coachRes.ok) setCoaches(await coachRes.json());
        if (clubRes.ok) setClubs(await clubRes.json());
      } catch (err) {
        console.error("Failed to fetch taluks or coaches:", err);
      }
    }
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    selectDistrict(e.target.value);
  };

  // Once all 6 pincode digits are in, look up the district/taluk and fill them
  // in. A taluk is only auto-selected when the pincode maps to exactly one.
  const [pincodeHint, setPincodeHint] = useState<{ text: string, tone: 'info' | 'error' } | null>(null);
  useEffect(() => {
    const pincode = formData.pincode;
    if (pincode.length !== 6) {
      setPincodeHint(null);
      return;
    }
    const controller = new AbortController();
    const lookup = async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api';
      setPincodeHint({ text: 'Looking up pincode...', tone: 'info' });
      try {
        const res = await fetch(`${apiUrl}/locations/pincode/${pincode}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) {
          setPincodeHint({ text: data.error || 'Pincode not found. Please select district and taluk manually.', tone: 'error' });
          return;
        }
        const matchedTaluks: { id: string, name: string }[] = data.taluks;
        const onlyTaluk = matchedTaluks.length === 1 ? matchedTaluks[0] : undefined;
        await selectDistrict(data.district.id, onlyTaluk);
        setPincodeHint({
          text: matchedTaluks.length > 1
            ? `${data.district.name} district. This pincode covers ${matchedTaluks.map(t => t.name).join(' / ')} — please choose your taluk.`
            : onlyTaluk
              ? `${data.district.name} district, ${onlyTaluk.name} taluk.`
              : `${data.district.name} district. Please choose your taluk.`,
          tone: 'info'
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.error("Pincode lookup failed:", err);
        setPincodeHint({ text: 'Could not look up pincode. Please select district and taluk manually.', tone: 'error' });
      }
    };
    lookup();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.pincode]);

  const handleTalukChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const talukId = e.target.value;
    const selectedTaluk = taluks.find(t => t.id === talukId);

    if (selectedTaluk) {
      setPincodeHint(null);
      setFormData(prev => ({
        ...prev,
        talukId,
        taluk: selectedTaluk.name
      }));
    } else {
      setFormData(prev => ({ ...prev, talukId: '', taluk: '' }));
    }
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'annualIncome' || name === 'age') {
      if (value === '') {
        setFormData(prev => ({ ...prev, [name]: '' }));
      } else {
        let numVal = parseFloat(value);
        if (!isNaN(numVal)) {
          if (numVal < 0) numVal = 0;
          setFormData(prev => ({ ...prev, [name]: numVal }));
        }
      }
    } else if (name === 'isBPL') {
      setFormData(prev => ({ ...prev, [name]: value === 'true' }));
    } else if (name === 'dob') {
      const clean = value.replace(/\D/g, '');
      let formatted = clean;
      if (clean.length > 2 && clean.length <= 4) {
        formatted = `${clean.slice(0, 2)}/${clean.slice(2)}`;
      } else if (clean.length > 4) {
        formatted = `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4, 8)}`;
      }

      // Automatically calculate age when DOB is fully entered (10 characters: DD/MM/YYYY)
      let calculatedAge = formData.age;
      if (formatted.length === 10) {
        const parts = formatted.split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 0-indexed month
        const year = parseInt(parts[2], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          const birthDate = new Date(year, month, day);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          if (age >= 0 && age < 120) {
            calculatedAge = age;
          }
        }
      }

      setFormData(prev => ({
        ...prev,
        dob: formatted,
        age: calculatedAge
      }));
    } else {
      const numberFields = ['mobileNumber', 'alternateMobileNumber', 'pincode', 'addressPincode', 'aadhaarNumber', 'whatsappNumber', 'annualIncome'];
      if (numberFields.includes(name)) {
        setFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '') }));
      } else if (name === 'email') {
        setFormData(prev => ({ ...prev, [name]: value.replace(/[^a-zA-Z0-9@._-]/g, '') }));
      } else if (['fullName', 'fatherName', 'city', 'state', 'schoolName', 'degreeDepartment'].includes(name)) {
        setFormData(prev => ({ ...prev, [name]: value.replace(/[^a-zA-Z\s.'-]/g, '') }));
      } else if (['address'].includes(name)) {
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
    if (!aadhaar.verified) {
      setError("Please verify your Aadhaar Number before submitting.");
      return;
    }
    if (!emailOtp.verified) {
      setError("Please verify your Email Address before submitting.");
      return;
    }
    if (!mobileOtp.verified) {
      setError("Please verify your Mobile Number before submitting.");
      return;
    }

    if (formData.isBPL && !formData.bplProof) {
      setError("Please upload proof for BPL Beneficiary.");
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
      const response = await fetch(`${apiUrl}/register/student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          dob: apiDob,
          aadhaarVerificationToken: aadhaar.verificationToken,
          emailVerificationToken: emailOtp.verificationToken,
          mobileVerificationToken: mobileOtp.verificationToken
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(result);
      } else {
        if (result.errors && Array.isArray(result.errors)) {
          const errorMsgs = result.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ');
          setError(errorMsgs);
        } else {
          setError(result.error || "Something went wrong");
        }
      }
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-[800px] mx-auto p-12 text-center bg-white border border-[#DEE2E6] rounded-sm shadow-xl">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="text-green-600" size={40} />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Registration Successful!</h2>
        <p className="text-gray-600 mb-8">Your application has been submitted and is waiting for approval.</p>

        <div className="bg-[#F8F9FA] p-6 rounded-lg mb-8 border border-[#E9ECEF]">
          <p className="text-sm text-gray-500 uppercase font-bold tracking-wider mb-2">Your Temporary Player ID</p>
          <p className="text-4xl font-mono font-bold text-[#FF7400]">{success.tempId}</p>
        </div>

        <p className="text-sm text-gray-600">
          Your credentials and Temporary Player ID have been sent to <strong>{formData.email}</strong>.
          Use the Temporary Player ID to log in and track your status.
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
    <div className="max-w-[1200px] mx-auto py-6 px-6">
      <form onSubmit={handleSubmit}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-12"
        >
          {/* Residing Location */}
          <section className="bg-white border border-[#DEE2E6] rounded-sm overflow-hidden shadow-sm">
            <SectionHeader title="Residing Location" />
            <div className="p-8 pt-2 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <SelectField
                  label="Residing / Studing District
"
                  name="districtId"
                  required
                  options={districts.map(d => ({ label: d.name, value: d.id }))}
                  value={formData.districtId}
                  onChange={handleDistrictChange}
                />
                <SelectField
                  label="Residing / Studing Taluk
"
                  name="talukId"
                  required
                  options={taluks.map(t => ({ label: t.name, value: t.id }))}
                  value={formData.talukId}
                  onChange={handleTalukChange}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-2">
                  <InputField
                    label="Residing / Studing Pincode
"
                    name="pincode"
                    placeholder="6 Digit Pincode"
                    required
                    value={formData.pincode}
                    onChange={handleInputChange}
                    maxLength={6}
                    autoComplete="off"
                  />
                  {pincodeHint && (
                    <p className={`text-xs ${pincodeHint.tone === 'error' ? 'text-red-500' : 'text-[#FF7400] font-medium'}`}>
                      {pincodeHint.text}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Personal Information */}
          <section className="bg-white border border-[#DEE2E6] rounded-sm overflow-hidden shadow-sm">
            <SectionHeader title="Personal Information" />
            <div className="p-8 pt-2">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column Input Fields */}
                <div className="lg:col-span-8 space-y-8">
                  <InputField
                    label="Full Name"
                    name="fullName"
                    placeholder="Enter Full Name"
                    required
                    icon={User}
                    value={formData.fullName}
                    onChange={handleInputChange}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                    <DatePickerField
                      label="Date of Birth"
                      name="dob"
                      required
                      value={formData.dob}
                      onChange={handleInputChange}
                      maxDate={new Date(new Date().setFullYear(new Date().getFullYear() - 3))}
                    />
                    <InputField
                      label="Age"
                      name="age"
                      type="number"
                      required
                      value={formData.age}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                {/* Right Column Profile Photo Uploader */}
                <div className="lg:col-span-4 h-full animate-in fade-in zoom-in-95 duration-200">
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

                {/* Rest of Personal Information below */}
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
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
                  <div className="flex flex-col gap-2 w-full">
                    <label className="text-xs font-bold text-gray-800 flex items-center gap-1">
                      Aadhaar Number <RequiredSymbol />
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="aadhaarNumber"
                        placeholder="12 Digit Aadhaar"
                        maxLength={12}
                        value={formData.aadhaarNumber}
                        onChange={handleInputChange}
                        disabled={aadhaar.verified || aadhaar.loading}
                        className={`w-full px-4 py-3 bg-white border border-[#DEE2E6] rounded text-sm text-gray-900 focus:outline-none focus:border-[#FF7400] focus:ring-1 focus:ring-[#FF7400]/20 transition-all placeholder:text-gray-400 ${aadhaar.verified || aadhaar.loading ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`}
                      />
                      {!aadhaar.verified ? (
                        <Button 
                          type="button" 
                          variant="primary" 
                          onClick={() => aadhaar.start(formData.aadhaarNumber, formData.email)}
                          disabled={aadhaar.loading || formData.aadhaarNumber.length !== 12}
                          className="whitespace-nowrap px-6"
                        >
                          {aadhaar.waiting ? 'Waiting...' : aadhaar.loading ? 'Starting...' : 'Verify'}
                        </Button>
                      ) : (
                        <div className="flex items-center justify-center px-4 bg-green-50 border border-green-200 text-green-600 rounded whitespace-nowrap font-bold text-sm">
                          <Check size={16} className="mr-1" /> Verified
                        </div>
                      )}
                    </div>
                    {aadhaar.error && <p className="text-red-500 text-xs font-medium">{aadhaar.error}</p>}
                    
                    {aadhaar.waiting && (
                      <div className="mt-2 p-4 bg-blue-50 border border-blue-100 rounded flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <p className="text-xs text-blue-800 font-medium">Complete the verification in the DigiLocker window: sign in with the OTP sent to your Aadhaar-linked mobile and allow access to your Aadhaar. This page updates automatically.</p>
                        <div className="flex gap-4 text-xs font-bold">
                          {aadhaar.authorizationUrl && (
                            <a href={aadhaar.authorizationUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">Open DigiLocker</a>
                          )}
                          <button type="button" onClick={aadhaar.cancel} className="text-gray-500 underline">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <OtpVerificationField
                    label="Mobile Number"
                    name="mobileNumber"
                    placeholder="10 Digit Mobile"
                    value={formData.mobileNumber}
                    onChange={handleInputChange}
                    otp={mobileOtp}
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
                  <OtpVerificationField
                    label="Email Address"
                    name="email"
                    placeholder="Enter Email Address"
                    value={formData.email}
                    onChange={handleInputChange}
                    otp={emailOtp}
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
              </div>
            </div>
          </section>

          {/* Address Information */}
          <section className="bg-white border border-[#DEE2E6] rounded-sm overflow-hidden shadow-sm">
            <SectionHeader title="Permanent Address Information" />
            <div className="p-8 pt-2 space-y-8">
              <InputField
                label="Address"
                name="address"
                placeholder="Door No, Street Name"
                required
                icon={MapPin}
                value={formData.address}
                onChange={handleInputChange}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InputField
                  label="City"
                  name="city"
                  placeholder="Enter City"
                  required
                  value={formData.city}
                  onChange={handleInputChange}
                />
                <InputField
                  label="State"
                  name="state"
                  placeholder="Enter State"
                  required
                  value={formData.state}
                  onChange={handleInputChange}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InputField
                  label="Pincode"
                  name="addressPincode"
                  placeholder="6 Digit Pincode"
                  required
                  value={formData.addressPincode}
                  onChange={handleInputChange}
                  maxLength={6}
                  autoComplete="off"
                />
               
              </div>
            </div>
          </section>

          {/* Financial Info */}
          <section className="bg-white border border-[#DEE2E6] rounded-sm overflow-hidden shadow-sm">
            <SectionHeader title="Financial Information" />
            <div className="p-8 pt-2 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-8">
                  <InputField
                    label="Family Annual Income"
                    name="annualIncome"
                    type="text"
                    maxLength={10}
                    placeholder="Enter Annual Income"
                    required
                    min={0}
                    value={formData.annualIncome}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="space-y-8">
                  <SelectField
                    label="Are you classified as a BPL beneficiary?"
                    name="isBPL"
                    required
                    options={[
                      { label: "Yes", value: "true" },
                      { label: "No", value: "false" }
                    ]}
                    value={formData.isBPL.toString()}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {formData.isBPL && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300 w-full flex items-center justify-center pt-4">
                  <div className="w-full lg:w-[400px]">
                    <FileUpload
                      label="Proof for BPL Beneficiary"
                      value={formData.bplProof}
                      onChange={(url) => setFormData(prev => ({ ...prev, bplProof: url }))}
                      accept="image/*,application/pdf"
                      helperText="JPG, PNG, WEBP or PDF (Max 5MB)"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Educational Information */}
          <section className="bg-white border border-[#DEE2E6] rounded-sm overflow-hidden shadow-sm">
            <SectionHeader title="Educational Information" />
            <div className="p-8 pt-2 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <SelectField
                  label="Institution Type"
                  name="institutionType"
                  required
                  options={[
                    { label: "School", value: "SCHOOL" },
                    { label: "College", value: "COLLEGE" },
                    { label: "Diploma", value: "DIPLOMA" }
                  ]}
                  value={formData.institutionType}
                  onChange={handleInputChange}
                />
                <InputField
                  label={formData.institutionType === "COLLEGE" ? "College Name" : formData.institutionType === "DIPLOMA" ? "Diploma Institution Name" : "School Name"}
                  name="schoolName"
                  placeholder={formData.institutionType === "COLLEGE" ? "Enter College Name" : formData.institutionType === "DIPLOMA" ? "Enter Diploma Institution Name" : "Enter School Name"}
                  required
                  icon={GraduationCap}
                  value={formData.schoolName}
                  onChange={handleInputChange}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {formData.institutionType === "SCHOOL" ? (
                  <SelectField
                    label="Standard"
                    name="grade"
                    required
                    options={[
                      { label: "1st Standard", value: "1st Standard" },
                      { label: "2nd Standard", value: "2nd Standard" },
                      { label: "3rd Standard", value: "3rd Standard" },
                      { label: "4th Standard", value: "4th Standard" },
                      { label: "5th Standard", value: "5th Standard" },
                      { label: "6th Standard", value: "6th Standard" },
                      { label: "7th Standard", value: "7th Standard" },
                      { label: "8th Standard", value: "8th Standard" },
                      { label: "9th Standard", value: "9th Standard" },
                      { label: "10th Standard", value: "10th Standard" },
                      { label: "11th Standard", value: "11th Standard" },
                      { label: "12th Standard", value: "12th Standard" }
                    ]}
                    value={formData.grade}
                    onChange={handleInputChange}
                  />
                ) : (
                  <>
                    <SelectField
                      label="Year"
                      name="grade"
                      required
                      options={[
                        { label: "1st Year", value: "1st Year" },
                        { label: "2nd Year", value: "2nd Year" },
                        { label: "3rd Year", value: "3rd Year" },
                        { label: "4th Year", value: "4th Year" },
                        { label: "5th Year", value: "5th Year" }
                      ]}
                      value={formData.grade}
                      onChange={handleInputChange}
                    />
                    <InputField
                      label="Degree Department"
                      name="degreeDepartment"
                      placeholder="e.g., B.Sc Computer Science"
                      value={formData.degreeDepartment}
                      onChange={handleInputChange}
                    />
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Academy Information */}
          <section className="bg-white border border-[#DEE2E6] rounded-sm overflow-hidden shadow-sm">
            <SectionHeader title="Academy Information" />
            <div className="p-8 pt-2 space-y-8">
              <div className="flex flex-col gap-4">
                <label className="text-xs font-bold text-gray-800">Register under (Optional)</label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="radio" name="academyType" value="NONE" checked={academyType === "NONE"} onChange={(e) => { setAcademyType("NONE"); setFormData(prev => ({...prev, clubId: '', coachId: ''})); }} className="accent-[#FF7400]" /> None
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="radio" name="academyType" value="CLUB" checked={academyType === "CLUB"} onChange={(e) => { setAcademyType("CLUB"); setFormData(prev => ({...prev, coachId: ''})); }} className="accent-[#FF7400]" /> Club
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="radio" name="academyType" value="COACH" checked={academyType === "COACH"} onChange={(e) => { setAcademyType("COACH"); setFormData(prev => ({...prev, clubId: ''})); }} className="accent-[#FF7400]" /> Coach
                  </label>
                </div>
              </div>

              {academyType === "CLUB" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <InputField
                      label="Enter Club Unique ID"
                      name="clubSearchId"
                      placeholder="e.g. TNJA-C-001"
                      value={clubSearchId}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const val = e.target.value;
                        setClubSearchId(val);
                        const match = clubs.find(c => 
                          c.tempId?.toLowerCase() === val.toLowerCase() || 
                          c.permanentId?.toLowerCase() === val.toLowerCase() ||
                          c.id === val
                        );
                        if (match) {
                          setFormData(prev => ({ ...prev, clubId: match.id }));
                        }
                      }}
                    />
                    <SelectField
                      label="Or Select Your Club"
                      name="clubId"
                      options={clubs.map(c => ({ label: c.name || (c as any).fullName, value: c.id }))}
                      value={formData.clubId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        handleInputChange(e);
                        setClubSearchId("");
                      }}
                    />
                  </div>
                  {formData.clubId && clubs.find(c => c.id === formData.clubId) && (
                    <div className="p-4 bg-orange-50 border border-orange-100 rounded text-sm text-gray-700 flex flex-col gap-2">
                      <p><strong>Club Found:</strong> {clubs.find(c => c.id === formData.clubId)?.name || (clubs.find(c => c.id === formData.clubId) as any)?.fullName}</p>
                      <p className="flex items-center gap-2"><Mail size={16} /> {clubs.find(c => c.id === formData.clubId)?.email}</p>
                      <p className="flex items-center gap-2"><Smartphone size={16} /> {clubs.find(c => c.id === formData.clubId)?.mobileNumber}</p>
                    </div>
                  )}
                </div>
              )}

              {academyType === "COACH" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <InputField
                      label="Enter Coach Unique ID"
                      name="coachSearchId"
                      placeholder="e.g. TNJA-CO-001"
                      value={coachSearchId}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const val = e.target.value;
                        setCoachSearchId(val);
                        const match = coaches.find(c => 
                          c.tempId?.toLowerCase() === val.toLowerCase() || 
                          c.permanentId?.toLowerCase() === val.toLowerCase() ||
                          c.id === val
                        );
                        if (match) {
                          setFormData(prev => ({ ...prev, coachId: match.id }));
                        }
                      }}
                    />
                    <SelectField
                      label="Or Select Your Coach"
                      name="coachId"
                      options={coaches.map(c => ({ label: c.fullName || (c as any).name, value: c.id }))}
                      value={formData.coachId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        handleInputChange(e);
                        setCoachSearchId("");
                      }}
                    />
                  </div>
                  {formData.coachId && coaches.find(c => c.id === formData.coachId) && (
                    <div className="p-4 bg-orange-50 border border-orange-100 rounded text-sm text-gray-700 flex flex-col gap-2">
                      <p><strong>Coach Found:</strong> {coaches.find(c => c.id === formData.coachId)?.fullName || (coaches.find(c => c.id === formData.coachId) as any)?.name}</p>
                      <p className="flex items-center gap-2"><Mail size={16} /> {coaches.find(c => c.id === formData.coachId)?.email}</p>
                      <p className="flex items-center gap-2"><Smartphone size={16} /> {coaches.find(c => c.id === formData.coachId)?.mobileNumber}</p>
                    </div>
                  )}
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
          <div className="p-4 space-y-8">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="agreedToTerms"
                  name="agreedToTerms"
                  checked={formData.agreedToTerms}
                  onChange={handleInputChange}
                  className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-[#DEE2E6] bg-white transition-all checked:bg-[#FF7400] checked:border-[#FF7400]"
                />
                <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                  <Check size={14} strokeWidth={4} />
                </span>
              </div>
              <label htmlFor="agreedToTerms" className="text-[13px] text-gray-700 font-medium">
                I agree to the <span className="text-[#FF7400] hover:underline cursor-pointer">Terms and Privacy policy</span>
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-44 shadow-lg"
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

export default PlayerRegistrationForm;
