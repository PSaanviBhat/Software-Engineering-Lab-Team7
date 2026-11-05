jest.mock("../src/lib/prisma", () => ({ emailLog: { create: jest.fn() } }));

const prisma = require("../src/lib/prisma");
const { recordFailure } = require("../src/workers/emailWorker");

// SRS F-022: 1 first try + 3 retries = 4 attempts.
const makeJob = (attemptsMade) => ({
  data: { bookingId: "b1", type: "CONFIRMATION" },
  opts: { attempts: 4 },
  attemptsMade,
});

describe("PTS-33 email failure log", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("logs RETRYING while retries remain", async () => {
    await recordFailure(makeJob(3), new Error("smtp down"));
    expect(prisma.emailLog.create).toHaveBeenCalledWith({
      data: { bookingId: "b1", type: "CONFIRMATION", status: "RETRYING", attempts: 3 },
    });
  });

  it("TC-NOTIF-04: logs FAILED once the last attempt has failed", async () => {
    await recordFailure(makeJob(4), new Error("smtp down"));
    expect(prisma.emailLog.create).toHaveBeenCalledWith({
      data: { bookingId: "b1", type: "CONFIRMATION", status: "FAILED", attempts: 4 },
    });
  });
});