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
  Linking,
  TextInput,
  TouchableOpacity,
  AppState,
} from 'react-native';
import { Colors } from 'react-native/Libraries/NewAppScreen';
import RNCalendarEvents from 'react-native-calendar-events';
import moment from 'moment';
import BackgroundTimer from 'react-native-background-timer';
import DatePicker from 'react-native-date-picker';
import {
  checkCalendarPermissions,
  fetchAllEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  saveLastSyncTime,
  loadLastSyncTime,
  processEvents,
  isCalendarPermissions
} from './calendar';

const SYNC_INTERVAL = 2 * 60 * 1000; // 2 minutes
const RETRY_INTERVAL = 10 * 1000; // 10 seconds
const MAX_RETRIES = 2;

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
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    
    const initializeSync = async () => {
      const lastSync = await loadLastSyncTime();
      setLastSyncTime(lastSync);
      checkCalendarPermissions();
  
      // Start periodic sync
      const syncInterval = BackgroundTimer.setInterval(() => {
        if (!hasError) {
          console.log("Interval called");
          checkCalendarAppWithSync();
        }
      }, SYNC_INTERVAL);
  
      return () => {
        BackgroundTimer.clearInterval(syncInterval);
      };
    };
  
    initializeSync();
  
    return () => {
      appStateSubscription.remove();
    }
  }, [hasError]);

  const handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active') {
      if (!hasError) {
        checkCalendarAppWithSync();
      } else {
        setHasError(false);
      }
    }
  };

  const checkCalendarAppWithSync = async (retryCount = 0) => {
    try {
      // Request access to calendar and retrieve the list of calendars
      const hasPermission = await isCalendarPermissions();
      if (!hasPermission) {
        setSyncStatus('Permission denied');
        return;
      }

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
      setHasError(true);
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
      const processedEvents = await processEvents(events);
      setEvents(processedEvents);
      const newLastSyncTime = await saveLastSyncTime();
      setLastSyncTime(newLastSyncTime);
      setSyncStatus('idle');
    } catch (error) {
      console.error('Sync failed:', error);
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => syncCalendar(retryCount + 1), RETRY_INTERVAL * (retryCount + 1));
      } else {
        setSyncStatus('error');
        Alert.alert('Sync Error', 'Failed to sync calendar. Please try again later.');
        setHasError(true);
      }
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
          Alert.alert('No Calendar App', 'No compatible calendar app found on yourdevice.');
        }
      } else {
        Alert.alert('Calendar App', 'Calendar app found and ready to use.');
      }
    } catch (error) {
      console.error('Error checking calendar app:', error);
    }
  };

  const handleCreateEvent = async () => {
    try {
      const hasPermission = await isCalendarPermissions();
      if (!hasPermission) {
        return;
      }
      
      const eventId = await createEvent(title, startDate, endDate, location, notes, calendarId);
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

      const hasPermission = await isCalendarPermissions();
      if (!hasPermission) {
        return;
      }

      const success = await updateEvent(selectedEvent.id, title, startDate, endDate, location, notes, calendarId);
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
      const hasPermission = await isCalendarPermissions();
      if (!hasPermission) {
        return;
      }

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
                onPress={() => {
                  setHasError(false);
                  checkCalendarAppWithSync()

                }}
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