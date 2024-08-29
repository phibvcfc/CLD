import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  Button,
  Alert,
  Platform,
  Linking,
  TextInput,
  TouchableOpacity,
  AppState,
  Modal,
} from 'react-native';
import { Colors } from 'react-native/Libraries/NewAppScreen';
import RNCalendarEvents from 'react-native-calendar-events';
import moment from 'moment';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundTimer from 'react-native-background-timer';
import DatePicker from 'react-native-date-picker';

const SYNC_INTERVAL = 2 * 60 * 1000; // 2 minutes
const RETRY_INTERVAL = 10 * 1000; // 10 seconds
const MAX_RETRIES = 3;

const App = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(new Date().getTime() + 60 * 60 * 1000));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [calendarId, setCalendarId] = useState('');

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    
    const initializeSync = async () => {
      await loadLastSyncTime();
      checkCalendarPermissions();
    
      // Initialize lastSyncTime if it's null
      if (lastSyncTime === null) {
        const oneWeekAgo = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
        setLastSyncTime(oneWeekAgo);
        saveLastSyncTime();
      }
  
      // Start periodic sync
      const syncInterval = BackgroundTimer.setInterval(() => {
        console.log("Interval called");
        checkCalendarAppWithSync();
      }, SYNC_INTERVAL);
  
      return () => {
        BackgroundTimer.clearInterval(syncInterval);
      };
    };
  
    initializeSync();
  
    return () => {
      appStateSubscription.remove();
    }
  }, []);
  

  const handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active') {
      checkCalendarAppWithSync();
    }
  };

  const loadLastSyncTime = async () => {
    try {
      const storedTime = await AsyncStorage.getItem('lastSyncTime');
      if (storedTime) {
        setLastSyncTime(new Date(JSON.parse(storedTime)));
      } else {
        // If no stored time, set it to one week ago
        const oneWeekAgo = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
        setLastSyncTime(oneWeekAgo);
        await saveLastSyncTime();
      }
    } catch (error) {
      console.error('Error loading last sync time:', error);
      // Set a default time if there's an error
      const oneWeekAgo = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
      setLastSyncTime(oneWeekAgo);
    }
  };

  const saveLastSyncTime = async () => {
    try {
      const currentTime = new Date();
      await AsyncStorage.setItem('lastSyncTime', JSON.stringify(currentTime));
      setLastSyncTime(currentTime);
    } catch (error) {
      console.error('Error saving last sync time:', error);
    }
  };

  const checkCalendarAppWithSync = async (retryCount = 0) => {
    try {
      // Request access to calendar and retrieve the list of calendars
      const calendars = await RNCalendarEvents.findCalendars();
  
      setCalendarId('')
      if (calendars.length === 0) {
        // If no calendars found, check for popular calendar apps
        const hasOutlook = await Linking.canOpenURL('ms-outlook://');
        const hasGoogleCalendar = await Linking.canOpenURL('content://com.android.calendar/');
  
        if (hasOutlook || hasGoogleCalendar) {
          syncCalendar(retryCount)
        } else {
          setSyncStatus('Calendar App not available')
          Alert.alert('No Calendar App', 'No compatible calendar app found on your device.');
        }
      } else {
        // Filter calendars that support modifications (which usually means sync is enabled)
        const syncedCalendars = calendars.filter(calendar => calendar.allowsModifications);
  
        if (syncedCalendars.length > 0) {
          // Now use the first synced calendar for any further actions
          const calendarId = syncedCalendars[0].id;
          console.log('Calendar' + calendarId)
          setCalendarId(calendarId);
          // Call a function to sync the calendar (example function)
          syncCalendar(retryCount);
        } else {
          setSyncStatus('Calendar App none of them support sync')
          Alert.alert('Calendar App', 'Calendars found, but none of them support sync.');
        }
      }
    } catch (error) {
      console.error('Error checking calendar app:', error);
      Alert.alert('Error', 'An error occurred while checking the calendar app.');
    }
  };
  
  const syncCalendar = async (retryCount = 0) => {
    if (syncStatus === 'syncing') return;
  
    setSyncStatus('syncing...');
    try {
      const now = new Date();
      // Function to reset time to the start of the day (00:00:00)
      const startOfDay = (date) => new Date(date.setHours(0, 0, 0, 0));

      // Calculate the default start and end dates
      const sevenDaysInMilliseconds = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

      const defaultStartDate = startOfDay(new Date(now.getTime() - sevenDaysInMilliseconds));
      const defaultEndDate = startOfDay(new Date(now.getTime() + sevenDaysInMilliseconds));

      // Use lastSyncTime if it's defined, otherwise use default dates
      const startDate = lastSyncTime ? startOfDay(new Date(lastSyncTime)) : defaultStartDate;
      const endDate = defaultEndDate;

      console.log('Default1 start date: ' + defaultStartDate + ' end date: ' + endDate);
      
      // Fetch events within the specified date range
      const events = await fetchAllEvents(defaultStartDate, endDate);
      await processEvents(events);
      await saveLastSyncTime();
      setSyncStatus('idle');
    } catch (error) {
      console.error('Sync failed:', error);
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => syncCalendar(retryCount + 1), RETRY_INTERVAL * (retryCount + 1));
      } else {
        setSyncStatus('error');
        Alert.alert('Sync Error', 'Failed to sync calendar. Please try again later.');
      }
    }
  };

  const processEvents = async (newEvents) => {
    try {
      const storedEvents = await AsyncStorage.getItem('localEvents');
      const localEvents = storedEvents ? JSON.parse(storedEvents) : [];
  
      // Map localEvents by id for quick lookup
      const localEventsMap = new Map(localEvents.map(e => [e.id, e]));
  
      // Determine new and updated events
      const newEventsList = newEvents.filter(newEvent => {
        // Check if the event is new or has been updated
        const localEvent = localEventsMap.get(newEvent.id);
        if (localEvent) {
          // Check if the event has been updated by comparing non-JSON fields
          return JSON.stringify(localEvent) !== JSON.stringify(newEvent);
        }
        // Event is new if it does not exist in localEvents
        return true;
      });
  
      // Determine deleted events
      const deletedEvents = localEvents.filter(localEvent =>
        !newEvents.some(newEvent => newEvent.id === localEvent.id)
      );
  
      // Sort events by start date
      const sortedEvents = [...newEvents].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  
      // Update local storage
      await AsyncStorage.setItem('localEvents', JSON.stringify(sortedEvents));
  
      // Update state
      setEvents(sortedEvents);
  
      // Log new events
      const addedEvents = newEvents.filter(newEvent => !localEventsMap.has(newEvent.id));
      if (addedEvents.length > 0) {
        console.log('Added events:');
        addedEvents.forEach((event : any) => {
          console.log(`Event ID: ${event.id}`);
          console.log(`Added Event:`, event);
        });
      }
  
      // Log specific updated events
      if (newEventsList.length > 0) {
        console.log('Updated events:');
        newEventsList.forEach((event : any) => {
          if (localEventsMap.has(event.id)) {
            console.log(`Event ID: ${event.id}`);
            console.log(`Updated Event:`, event);
          }
        });
      }
  
      // Log specific deleted events
      if (deletedEvents.length > 0) {
        console.log('Deleted events:');
        deletedEvents.forEach((event : any) => {
          console.log(`Event ID: ${event.id}`);
          console.log(`Deleted Event:`, event);
        });
      }
  
    } catch (error) {
      console.error('Error processing events:', error);
      throw error;
    }
  };
  

  const checkCalendarPermissions = async () => {
    try {
      const authStatus = await RNCalendarEvents.checkPermissions();
      if (authStatus !== 'authorized') {
        await requestCalendarPermissions();
      }
    } catch (error) {
      console.error('Error checking calendar permissions:', error);
    }
  };

  const requestCalendarPermissions = async () => {
    try {
      const authStatus = await RNCalendarEvents.requestPermissions(false);
      if (authStatus !== 'authorized') {
        Alert.alert('Permission Required', 'This app requires access to your calendar to function properly.');
      }
    } catch (error) {
      console.error('Error requesting calendar permissions:', error);
    }
  };

  const checkCalendarApp = async () => {
    try {
      const calendars = await RNCalendarEvents.findCalendars();
      if (calendars.length === 0) {
        // No default calendar app found, check for alternatives
        const hasOutlook = await Linking.canOpenURL('ms-outlook://');
        const hasGoogleCalendar = await Linking.canOpenURL('content://com.android.calendar/');
        
        if (hasOutlook || hasGoogleCalendar) {
          Alert.alert('Calendar App', 'Please enable calendar sync in your Outlook or Google Calendar app settings.');
        } else {
          Alert.alert('No Calendar App', 'No compatible calendar app found on your device.');
        }
      } else {
        Alert.alert('Calendar App', 'Calendar app found and ready to use.');
      }
    } catch (error) {
      console.error('Error checking calendar app:', error);
    }
  };

  const fetchAllEvents = async (startDate, endDate) => {
    try {
      if (!startDate || !endDate) {
        throw new Error('Invalid date range for fetching events');
      }
      const events = await RNCalendarEvents.fetchAllEvents(
        startDate.toISOString(),
        endDate.toISOString()
      );
      return events;
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  };

  const createEvent = async (title, startDate, endDate, location, notes) => {
    try {
      const eventId = await RNCalendarEvents.saveEvent(title, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        location: location,
        notes: notes,
        alarms: [
          { date: -30 } // Reminder 30 minutes before the event
        ],
        ...(calendarId ? { calendarId: calendarId } : {})
      });
      return eventId;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  };

  const updateEvent = async (eventId, title, startDate, endDate, location, notes) => {
    try {
      await RNCalendarEvents.saveEvent(title, {
        id: eventId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        location: location,
        notes: notes,
        alarms: [
          { date: -30 } // Reminder 30 minutes before the event
        ],
        ...(calendarId ? { calendarId: calendarId } : {})
      });
      return true;
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  };

  const deleteEvent = async (eventId) => {
    try {
      await RNCalendarEvents.removeEvent(eventId);
      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  };

  const handleCreateEvent = async () => {
    try {
      const eventId = await createEvent(title, startDate, endDate, location, notes);
      if (eventId) {
        Alert.alert('Event Created', `Event created with ID: ${eventId}`);
        await syncCalendar();
        clearForm();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create event');
    }
  };

  const handleUpdateEvent = async () => {
    if (!selectedEvent) {
      Alert.alert('Error', 'No event selected');
      return;
    }

    try {
      const success = await updateEvent(selectedEvent.id, title, startDate, endDate, location, notes);
      if (success) {
        Alert.alert('Event Updated', 'Event updated successfully');
        await syncCalendar();
        clearForm();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update event');
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) {
      Alert.alert('Error', 'No event selected');
      return;
    }

    try {
      const success = await deleteEvent(selectedEvent.id);
      if (success) {
        Alert.alert('Event Deleted', 'Event deleted successfully');
        await syncCalendar();
        clearForm();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete event');
    }
  };

  const selectEvent = (event) => {
    setSelectedEvent(event);
    setTitle(event.title);
    setLocation(event.location || '');
    setNotes(event.notes || '');
    setStartDate(new Date(event.startDate));
    setEndDate(new Date(event.endDate));
  };

  const clearForm = () => {
    setSelectedEvent(null);
    setTitle('');
    setLocation('');
    setNotes('');
    setStartDate(new Date());
    setEndDate(new Date(new Date().getTime() + 60 * 60 * 1000));
  };
  
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={styles.scrollView}>
          <View style={styles.body}>
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Calendar Sync</Text>
              <Button
                title="Check Calendar Permissions"
                onPress={checkCalendarPermissions}
                color="blue"
              />
              <Button
                title="Check Calendar App"
                onPress={checkCalendarApp}
                color="green"
              />
              <Button
                title="Sync Calendar"
                onPress={() => checkCalendarAppWithSync()}
                color="purple"
              />
              <Text>Last Sync: {lastSyncTime ? lastSyncTime.toLocaleString() : 'Never'}</Text>
              <Text>Sync Status: {syncStatus}</Text>
            </View>

            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Event Form</Text>
              <TextInput
                style={styles.input}
                placeholder="Title"
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                style={styles.input}
                placeholder="Location"
                value={location}
                onChangeText={setLocation}
              />
              <TextInput
                style={styles.input}
                placeholder="Notes"
                value={notes}
                onChangeText={setNotes}
                multiline
              />
              <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateButton}>
                <Text>Start: {moment(startDate).format('MMMM Do YYYY, h:mm a')}</Text>
              </TouchableOpacity>
              <DatePicker
                modal
                open={showStartPicker}
                date={startDate}
                onConfirm={(date) => {
                  setShowStartPicker(false)
                  setStartDate(date)
                }}
                onCancel={() => {
                  setShowStartPicker(false)
                }}
              />
              <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateButton}>
                <Text>End: {moment(endDate).format('MMMM Do YYYY, h:mm a')}</Text>
              </TouchableOpacity>
              <DatePicker
                modal
                open={showEndPicker}
                date={endDate}
                onConfirm={(date) => {
                  setShowEndPicker(false)
                  setEndDate(date)
                }}
                onCancel={() => {
                  setShowEndPicker(false)
                }}
              />
              <Button
                title={selectedEvent ? "Update Event" : "Create Event"}
                onPress={selectedEvent ? handleUpdateEvent : handleCreateEvent}
              />
              {selectedEvent && (
                <Button
                  title="Delete Event"
                  onPress={handleDeleteEvent}
                  color="red"
                />
              )}
              <Button
              title="Clear Form"
              onPress={clearForm}
            />
          </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Event List</Text>
            <Button
              title="Fetch Events"
              onPress={() => {
                fetchAllEvents(new Date(), new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000))
                  .then(fetchedEvents => {
                    setEvents(fetchedEvents);
                    Alert.alert('Events Fetched', `Found ${fetchedEvents.length} events`);
                  })
                  .catch(error => {
                    console.error('Error fetching events:', error);
                    Alert.alert('Error', 'Failed to fetch events');
                  });
              }}
            />
            {events.map((event, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.eventItem} 
                onPress={() => selectEvent(event)}
              >
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventTime}>
                  {moment(event.startDate).format('MMMM Do YYYY, h:mm a')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  </>
);
};

const styles = StyleSheet.create({
scrollView: {
  backgroundColor: Colors.lighter,
},
body: {
  backgroundColor: Colors.white,
},
sectionContainer: {
  marginTop: 32,
  paddingHorizontal: 24,
},
sectionTitle: {
  fontSize: 24,
  fontWeight: '600',
  color: Colors.black,
  marginBottom: 16,
},
eventItem: {
  backgroundColor: '#f0f0f0',
  padding: 10,
  marginBottom: 10,
  borderRadius: 5,
},
eventTitle: {
  fontSize: 16,
  fontWeight: 'bold',
  color: Colors.black,
},
eventTime: {
  fontSize: 14,
  color: Colors.dark,
},
input: {
  height: 40,
  borderColor: 'gray',
  borderWidth: 1,
  marginBottom: 10,
  paddingHorizontal: 10,
  color: Colors.black,
},
dateButton: {
  backgroundColor: '#e0e0e0',
  padding: 10,
  marginBottom: 10,
  borderRadius: 5,
},
});

export default App;