import { describe, expect, it } from "vitest";

import {
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirmation,
} from "@/features/auth/validation";
import {
  MAX_FILE_SIZE_BYTES,
  formatFileSize,
  getFileExtension,
  validateDemoEegFile,
} from "@/features/upload/validation";

function fileOf(name: string, size: number): File {
  return { name, size } as File;
}

describe("auth validation", () => {
  it("validates names", () => {
    expect(validateName("")).toBeDefined();
    expect(validateName(" a ")).toBeDefined();
    expect(validateName("Al")).toBeUndefined();
    expect(validateName("x".repeat(121))).toBeDefined();
    expect(validateName("x".repeat(120))).toBeUndefined();
  });

  it("validates emails", () => {
    expect(validateEmail("")).toBeDefined();
    expect(validateEmail("no-at-sign")).toBeDefined();
    expect(validateEmail("a@b")).toBeDefined();
    expect(validateEmail("with space@x.com")).toBeDefined();
    expect(validateEmail(" user@example.com ")).toBeUndefined();
  });

  it("validates passwords", () => {
    expect(validatePassword("")).toBeDefined();
    expect(validatePassword("short")).toBeDefined();
    expect(validatePassword("long-enough")).toBeUndefined();
    expect(validatePassword("12345", 5)).toBeUndefined();
  });

  it("validates password confirmation", () => {
    expect(validatePasswordConfirmation("secret-pass", "")).toBeDefined();
    expect(validatePasswordConfirmation("secret-pass", "different")).toBeDefined();
    expect(validatePasswordConfirmation("secret-pass", "secret-pass")).toBeUndefined();
  });
});

describe("upload validation", () => {
  it("extracts lowercase extensions", () => {
    expect(getFileExtension("Recording.EDF")).toBe(".edf");
    expect(getFileExtension("archive.tar.csv")).toBe(".csv");
    expect(getFileExtension("noextension")).toBe("");
  });

  it("accepts csv, edf and bdf within the size limit", () => {
    for (const name of ["a.csv", "a.edf", "a.BDF"]) {
      expect(validateDemoEegFile(fileOf(name, 1024))).toBeUndefined();
    }
    expect(validateDemoEegFile(fileOf("a.csv", MAX_FILE_SIZE_BYTES))).toBeUndefined();
  });

  it("rejects unsupported types, empty files and oversize files", () => {
    expect(validateDemoEegFile(fileOf("a.exe", 10))).toMatch(/\.csv, \.edf, or \.bdf/);
    expect(validateDemoEegFile(fileOf("a.csv", 0))).toMatch(/empty/);
    expect(validateDemoEegFile(fileOf("a.csv", MAX_FILE_SIZE_BYTES + 1))).toMatch(/larger than 25 MB/);
  });

  it("formats sizes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(20 * 1024)).toBe("20 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
