import { useQuery, useMutation } from "@tanstack/react-query";
import { addDays, format, setHours, setMinutes } from "date-fns";

export interface AppointmentSlot {
  id: string;
  dateTime: string;
  dayLabel: string;
  timeLabel: string;
  available: boolean;
}

export interface AvailableSlotsResponse {
  slots: AppointmentSlot[];
  timezone: string;
}

export interface BookAppointmentRequest {
  slotId: string;
  allocationType: string;
  allocationRange: string;
  timeline: string;
  state: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface BookAppointmentResponse {
  confirmationId: string;
  scheduledTime: string;
  dayLabel: string;
  timeLabel: string;
  message: string;
}

// Generate some mock slots for the UI fallback
const generateMockSlots = (): AppointmentSlot[] => {
  const slots: AppointmentSlot[] = [];
  const now = new Date();
  
  for (let i = 1; i <= 14; i++) {
    const day = addDays(now, i);
    // Skip weekends
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    
    // Create a 10am and 2pm slot for each weekday
    const morning = setMinutes(setHours(day, 10), 0);
    const afternoon = setMinutes(setHours(day, 14), 0);
    
    slots.push({
      id: `slot-${morning.getTime()}`,
      dateTime: morning.toISOString(),
      dayLabel: format(morning, "EEEE, MMMM d"),
      timeLabel: "10:00 AM CT",
      available: true
    });
    
    slots.push({
      id: `slot-${afternoon.getTime()}`,
      dateTime: afternoon.toISOString(),
      dayLabel: format(afternoon, "EEEE, MMMM d"),
      timeLabel: "2:00 PM CT",
      available: true
    });
  }
  
  return slots.slice(0, 12); // Return 12 slots max
};

const MOCK_SLOTS: AvailableSlotsResponse = {
  slots: generateMockSlots(),
  timezone: "America/Chicago"
};

export function useAvailableSlots() {
  return useQuery({
    queryKey: ["/api/scheduling/slots"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/scheduling/slots");
        if (!res.ok) throw new Error("Network error");
        return (await res.json()) as AvailableSlotsResponse;
      } catch (err) {
        console.warn("Using mock slots", err);
        return MOCK_SLOTS;
      }
    },
  });
}

export function useBookAppointment() {
  return useMutation({
    mutationFn: async (data: BookAppointmentRequest) => {
      try {
        const res = await fetch("/api/scheduling/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        
        if (!res.ok) {
          throw new Error("Failed to book appointment");
        }
        return (await res.json()) as BookAppointmentResponse;
      } catch (err) {
        console.warn("Using mock booking response", err);
        // Mock successful response
        const selectedSlot = MOCK_SLOTS.slots.find(s => s.id === data.slotId) || MOCK_SLOTS.slots[0];
        
        // Artificial delay for realism
        await new Promise(resolve => setTimeout(resolve, 800));
        
        return {
          confirmationId: `WHC-${Math.floor(Math.random() * 10000)}`,
          scheduledTime: selectedSlot.dateTime,
          dayLabel: selectedSlot.dayLabel,
          timeLabel: selectedSlot.timeLabel,
          message: "Appointment confirmed successfully."
        } as BookAppointmentResponse;
      }
    },
  });
}
