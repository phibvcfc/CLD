import RNCalendarEvents from 'react-native-calendar-events';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';


interface Event {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    location?: string;
    notes?: string;
  }

export const checkCalendarPermissions = async () => {
  try {
    const authStatus = await RNCalendarEvents.checkPermissions();
    if (authStatus !== 'authorized') {
      await requestCalendarPermissions();
    }
  } catch (error) {
    console.error('Error checking calendar permissions:', error);
  }
};

export const isCalendarPermissions = async () => {
    try {
        const authStatus = await RNCalendarEvents.checkPermissions();
        return authStatus === 'authorized'
    } catch (error) {
        return true;
    }
};

export const requestCalendarPermissions = async () => {
  try {
    const authStatus = await RNCalendarEvents.requestPermissions(false);
    // if (authStatus !== 'authorized') {
    //   Alert.alert('Permission Required', 'This app requires access to your calendar to function properly.');
    // }
  } catch (error) {
    console.error('Error requesting calendar permissions:', error);
  }
};

export const fetchAllEvents = async (startDate: Date, endDate: Date): Promise<Event[]> => {
    try {
      if (!startDate || !endDate) {
        throw new Error('Invalid date range for fetching events');
      }
      const events = await RNCalendarEvents.fetchAllEvents(
        startDate.toISOString(),
        endDate.toISOString()
      );
      return events as Event[];
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
};  

export const createEvent = async (
    title: string,
    startDate: Date,
    endDate: Date,
    location?: string,
    notes?: string,
    calendarId?: string
  ): Promise<string> => {
    try {
      const eventId = await RNCalendarEvents.saveEvent(title, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        location: location,
        notes: notes,
        alarms: [{ date: -30 }],
        ...(calendarId ? { calendarId: calendarId } : {}),
      });
      return eventId;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  };
  

  export const updateEvent = async (
    eventId: string,
    title: string,
    startDate: Date,
    endDate: Date,
    location?: string,
    notes?: string,
    calendarId?: string
  ): Promise<boolean> => {
    try {
      await RNCalendarEvents.saveEvent(title, {
        id: eventId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        location: location,
        notes: notes,
        alarms: [{ date: -30 }],
        ...(calendarId ? { calendarId: calendarId } : {}),
      });
      return true;
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
};  

export const deleteEvent = async (eventId: string): Promise<boolean> => {
    try {
      await RNCalendarEvents.removeEvent(eventId);
      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
};
  

export const saveLastSyncTime = async (): Promise<Date> => {
    try {
      const currentTime = new Date();
      await AsyncStorage.setItem('lastSyncTime', JSON.stringify(currentTime));
      return currentTime;
    } catch (error) {
      console.error('Error saving last sync time:', error);
      throw error;
    }
};

export const loadLastSyncTime = async (): Promise<Date> => {
    try {
      const storedTime = await AsyncStorage.getItem('lastSyncTime');
      if (storedTime) {
        return new Date(JSON.parse(storedTime));
      } else {
        const oneWeekAgo = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
        await saveLastSyncTime();
        return oneWeekAgo;
      }
    } catch (error) {
      console.error('Error loading last sync time:', error);
      const oneWeekAgo = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
      return oneWeekAgo;
    }
};
  

  export const processEvents = async (newEvents: Event[]): Promise<Event[]> => {
    try {
      const storedEvents = await AsyncStorage.getItem('localEvents');
      const localEvents: Event[] = storedEvents ? JSON.parse(storedEvents) : [];
  
      const localEventsMap = new Map(localEvents.map(e => [e.id, e]));
  
      const addedEvents: Event[] = [];
      const updatedEvents: Event[] = [];
  
      newEvents.forEach(newEvent => {
        const localEvent = localEventsMap.get(newEvent.id);
        if (!localEvent) {
          addedEvents.push(newEvent);
        } else if (JSON.stringify(localEvent) !== JSON.stringify(newEvent)) {
          updatedEvents.push(newEvent);
        }
      });
  
      const deletedEvents: Event[] = localEvents.filter(localEvent =>
        !newEvents.some(newEvent => newEvent.id === localEvent.id)
      );
  
      const sortedEvents = [...newEvents].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  
      await AsyncStorage.setItem('localEvents', JSON.stringify(sortedEvents));
  
      logEventChanges(addedEvents, updatedEvents, deletedEvents);
  
      return sortedEvents;
    } catch (error) {
      console.error('Error processing events:', error);
      throw error;
    }
  };
  

  const logEventChanges = (addedEvents: Event[], updatedEvents: Event[], deletedEvents: Event[]): void => {
    if (addedEvents.length > 0) {
      console.log('Added events:');
      addedEvents.forEach(event => {
        console.log(`Event ID: ${event.id}`, event);
      });
    }
  
    if (updatedEvents.length > 0) {
      console.log('Updated events:');
      updatedEvents.forEach(event => {
        console.log(`Event ID: ${event.id}`, event);
      });
    }
  
    if (deletedEvents.length > 0) {
      console.log('Deleted events:');
      deletedEvents.forEach(event => {
        console.log(`Event ID: ${event.id}`, event);
      });
    }
  };
  

// export const processEvents = async (newEvents) => {
//     try {
//       const storedEvents = await AsyncStorage.getItem('localEvents');
//       const localEvents = storedEvents ? JSON.parse(storedEvents) : [];
  
//       // Map localEvents by id for quick lookup
//       const localEventsMap = new Map(localEvents.map(e => [e.id, e]));
  
//       // Determine new events (added)
//       const addedEvents = newEvents.filter(newEvent => !localEventsMap.has(newEvent.id));
  
//       // Determine updated events, excluding new events
//       const updatedEvents = newEvents.filter(newEvent => {
//         const localEvent = localEventsMap.get(newEvent.id);
//         return localEvent && JSON.stringify(localEvent) !== JSON.stringify(newEvent);
//       });
  
//       // Determine deleted events
//       const deletedEvents = localEvents.filter(localEvent =>
//         !newEvents.some(newEvent => newEvent.id === localEvent.id)
//       );
  
//       // Sort events by start date
//       const sortedEvents = [...newEvents].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  
//       // Update local storage
//       await AsyncStorage.setItem('localEvents', JSON.stringify(sortedEvents));
  
//       // Log new events
//       if (addedEvents.length > 0) {
//         console.log('Added events:');
//         addedEvents.forEach(event => {
//           console.log(`Event ID: ${event.id}`);
//           console.log('Added Event:', event);
//         });
//       }
  
//       // Log updated events
//       if (updatedEvents.length > 0) {
//         console.log('Updated events:');
//         updatedEvents.forEach(event => {
//           console.log(`Event ID: ${event.id}`);
//           console.log('Updated Event:', event);
//         });
//       }
  
//       // Log deleted events
//       if (deletedEvents.length > 0) {
//         console.log('Deleted events:');
//         deletedEvents.forEach(event => {
//           console.log(`Event ID: ${event.id}`);
//           console.log('Deleted Event:', event);
//         });
//       }
  
//       // Return the sorted list of events
//       return sortedEvents;
//     } catch (error) {
//       console.error('Error processing events:', error);
//       throw error;
//     }
//   };
  