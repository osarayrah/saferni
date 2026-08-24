// User-facing copy for each booking status, shared with tests so the
// paid-but-not-booked messaging stays accurate (no unbacked promises).

export type BookingStatus = 'paid' | 'booked' | 'booking_failed' | 'cancelled';

export interface StatusCopy {
  icon: 'clock' | 'loader' | 'check-circle' | 'alert-triangle' | 'x-circle';
  title: string;
  message: string;
}

export interface StatusCopyOpts {
  contactEmail: string;
  /** From the API: present + true when that part of the trip is confirmed with the supplier. */
  flightConfirmed?: boolean;
  hotelConfirmed?: boolean;
}

export function bookingStatusCopy(status: BookingStatus, opts: StatusCopyOpts): StatusCopy {
  // booking_failed means not everything requested was confirmed — but one part
  // (flight or hotel) may already be booked. Be precise so travelers don't
  // think a confirmed reservation doesn't exist.
  const bookingFailed: StatusCopy =
    opts.flightConfirmed && !opts.hotelConfirmed
      ? {
          icon: 'alert-triangle',
          title: 'Paid — flight confirmed, hotel needs attention',
          message:
            'Your flight is confirmed (reference below), but we could not confirm your hotel with the travel provider.',
        }
      : opts.hotelConfirmed && !opts.flightConfirmed
        ? {
            icon: 'alert-triangle',
            title: 'Paid — hotel confirmed, flight needs attention',
            message:
              'Your hotel is confirmed (reference below), but we could not confirm your flight with the travel provider.',
          }
        : {
            icon: 'alert-triangle',
            title: 'Paid, but your trip is not booked yet',
            message:
              'We could not confirm your reservation with the travel provider. Contact support for next steps.',
          };
  const copy: Record<BookingStatus, StatusCopy> = {
    paid: {
      icon: 'loader',
      title: 'Booking your trip',
      message: 'We are confirming your reservation with the travel provider. This usually takes under a minute.',
    },
    booked: {
      icon: 'check-circle',
      title: 'Trip booked!',
      message: `Confirmation details were sent to ${opts.contactEmail}.`,
    },
    booking_failed: bookingFailed,
    cancelled: {
      icon: 'x-circle',
      title: 'Booking cancelled',
      message: 'You can start the booking again any time.',
    },
  };
  return copy[status];
}

/** Guidance shown in the "What happens next" card for a failed-but-paid booking. */
export function bookingFailedNextSteps(opts: {
  contactEmail: string;
  bookingId: string;
  flightConfirmed?: boolean;
  hotelConfirmed?: boolean;
}): string {
  const partial = Boolean(opts.flightConfirmed) !== Boolean(opts.hotelConfirmed);
  const intro = partial
    ? `Keep the confirmed reservation reference below — it is valid. For the part that could not be confirmed, contact `
    : `Contact `;
  return (
    intro +
    `support@safferni.app from ${opts.contactEmail} and mention booking ID ${opts.bookingId.slice(0, 8)} — ` +
    `we'll work with you to complete the remaining reservation.`
  );
}
