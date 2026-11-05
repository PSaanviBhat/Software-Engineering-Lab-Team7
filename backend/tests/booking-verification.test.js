const prisma = require("../src/lib/prisma");
const { createBooking } = require("../src/services/bookingService");

jest.mock("../src/lib/prisma", () => ({
  user: { findUnique: jest.fn() },
  slot: { findUnique: jest.fn() },
}));

describe("Booking email verification guard - TC-AUTH-02", () => {
  it("rejects unverified learners before reading the slot", async () => {
    prisma.user.findUnique.mockResolvedValue({ verified: false });

    await expect(
      createBooking({ learnerId: "learner-1", slotId: "slot-1" })
    ).rejects.toMatchObject({
      status: 403,
      code: "EMAIL_NOT_VERIFIED",
    });
    expect(prisma.slot.findUnique).not.toHaveBeenCalled();
  });
});
