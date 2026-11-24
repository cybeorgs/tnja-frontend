import { z } from "zod";

export const adminStudentSchema = z.object({
  fullName: z.string().min(3, "Full name is required (min 3 chars)"),
  fatherName: z.string().trim().max(100).optional(),
  email: z.string().trim().email("Enter a valid email address"),
  mobileNumber: z.string().regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit mobile number starting with 6-9"),
  districtId: z.string().min(1, "District is required"),
  talukId: z.string().min(1, "Taluk is required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  dob: z.string().min(1, "Date of Birth is required"),
  aadhaarNumber: z.string().regex(/^[2-9][0-9]{11}$/, "Enter a valid 12-digit Aadhaar number"),
  bloodGroup: z.string().min(1, "Blood Group is required"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  addressPincode: z.string().length(6, "Pincode must be exactly 6 digits"),
  nationality: z.string().min(1, "Nationality is required"),
  annualIncome: z.string().min(1, "Annual Income is required"),
  schoolName: z.string().min(1, "School Name is required"),
  grade: z.string().min(1, "Grade is required"),
  areaOfInterest: z.string().optional(),
  areaOfStudy: z.string().optional(),
  preferLocation: z.string().optional(),
});

export const adminClubSchema = z.object({
  name: z.string().min(1, "Club name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  mobileNumber: z.string().regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit mobile number starting with 6-9"),
  districtId: z.string().min(1, "District is required"),
  talukId: z.string().min(1, "Taluk is required"),
  address1: z.string().min(1, "Address Line 1 is required"),
  address2: z.string().optional(),
  pincode: z.string().length(6, "Pincode must be exactly 6 digits"),
  president: z.string().min(1, "President Name is required"),
  secretary: z.string().min(1, "Secretary Name is required"),
  coach: z.string().min(1, "Coach Name is required"),
});

export const adminMemberSchema = z.object({
  fullName: z.string().min(3, "Full name is required (min 3 chars)"),
  email: z.string().trim().email("Enter a valid email address"),
  mobileNumber: z.string().regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit mobile number starting with 6-9"),
  districtId: z.string().min(1, "District is required"),
  talukId: z.string().min(1, "Taluk is required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  dob: z.string().min(1, "Date of Birth is required"),
  aadhaarNumber: z.string().regex(/^[2-9][0-9]{11}$/, "Enter a valid 12-digit Aadhaar number"),
  fatherName: z.string().min(3, "Father's name is required"),
  bloodGroup: z.string().min(1, "Blood Group is required"),
  addressLine1: z.string().min(1, "Address Line 1 is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  addressPincode: z.string().length(6, "Pincode must be exactly 6 digits"),
});

/** Blank is allowed; anything typed must still be valid. */
const blankOr = (schema: z.ZodString) => z.union([z.literal(""), schema]).optional();

/** Admin-created coach: only name, email, mobile and representing district are required. */
export const adminCoachSchema = z.object({
  fullName: z.string().trim().min(3, "Full name is required (min 3 chars)"),
  email: z.string().trim().email("Enter a valid email address"),
  mobileNumber: z.string().regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit mobile number starting with 6-9"),
  districtId: z.string().min(1, "Representing district is required"),
  aadhaarNumber: blankOr(z.string().regex(/^[2-9][0-9]{11}$/, "Enter a valid 12-digit Aadhaar number")),
  addressPincode: blankOr(z.string().regex(/^[0-9]{6}$/, "Pincode must be exactly 6 digits")),
});
