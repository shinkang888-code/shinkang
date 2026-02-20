// Unit test global setup
import { vi } from "vitest";

// Silence console during tests unless explicitly checking output
vi.spyOn(console, "error").mockImplementation(() => {});
