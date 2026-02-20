"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import koLocale from "@fullcalendar/core/locales/ko";
import type { CalendarEvent } from "@/types";

interface Props {
  events: CalendarEvent[];
  onDateSelect: (selectInfo: { startStr: string; endStr: string }) => void;
  onEventClick: (event: CalendarEvent) => void;
  onDatesSet: (from: string, to: string) => void;
}

export default function FullCalendarWrapper({
  events,
  onDateSelect,
  onEventClick,
  onDatesSet,
}: Props) {
  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      locale={koLocale}
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay",
      }}
      events={events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        backgroundColor: e.color ?? "#4F46E5",
        borderColor: e.color ?? "#4F46E5",
        extendedProps: e.extendedProps,
      }))}
      selectable
      selectMirror
      dayMaxEvents
      weekends
      select={(info) =>
        onDateSelect({ startStr: info.startStr, endStr: info.endStr })
      }
      eventClick={(info) => {
        const event = events.find((e) => e.id === info.event.id);
        if (event) onEventClick(event);
      }}
      datesSet={(info) => onDatesSet(info.startStr, info.endStr)}
      height="auto"
      contentHeight={600}
      eventClassNames="cursor-pointer rounded-lg"
    />
  );
}
