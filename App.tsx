import React, { useState } from 'react';
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
} from 'react-native';
import { Header, Colors } from 'react-native/Libraries/NewAppScreen';
import RNCalendarEvents from 'react-native-calendar-events';
import moment from 'moment';
import DateTimePicker from '@react-native-community/datetimepicker';

export const addToIosCalendar = async (
  title: string,
  startDate: any,
  endDate: any,
  location: string,
  url: string
) => {
  // iOS: Requires # of seconds from January 1 2001 of the date you want to open calendar on
  const referenceDate = moment.utc('2001-01-01');
  const secondsSinceRefDateiOS = startDate - referenceDate.unix();
  try {
    await RNCalendarEvents.requestPermissions(false);
    await RNCalendarEvents.checkPermissions(true);
    await RNCalendarEvents.saveEvent(title, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      location: location,
      notes: title,
      url: url,
      alarms: [
        { date: startDate.toISOString() - 6000 },
      ],
    });
    Linking.openURL(`calshow:${secondsSinceRefDateiOS}`);
  } catch (error) {
    //  showMessage(calendarIosFail);
    return null;
  }
};

const fetchAllEvents = async (startDate, endDate) => {
  try {
    const hasPermission = await RNCalendarEvents.checkPermissions();
    if (hasPermission !== 'authorized') {
      const requestedPermission = await RNCalendarEvents.requestPermissions();
      if (requestedPermission !== 'authorized') {
        throw new Error('Calendar permission not granted');
      }
    }

    const calendars = await RNCalendarEvents.findCalendars();
    const calendarIds = calendars.map(calendar => calendar.id);

    const events = await RNCalendarEvents.fetchAllEvents(
      startDate.toISOString(),
      endDate.toISOString(),
      calendarIds
    );
    console.log(JSON.stringify(events));

    return events;
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
};

const createEvent = async (title, startDate, endDate, location, notes) => {
  try {
    const hasPermission = await RNCalendarEvents.checkPermissions();
    if (hasPermission !== 'authorized') {
      const requestedPermission = await RNCalendarEvents.requestPermissions();
      if (requestedPermission !== 'authorized') {
        throw new Error('Calendar permission not granted');
      }
    }

    const eventId = await RNCalendarEvents.saveEvent(title, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      location: location,
      notes: notes,
      alarms: [
        { date: -30 } // Reminder 30 minutes before the event
      ]
    });

    return eventId;
  } catch (error) {
    console.error('Error creating event:', error);
    return null;
  }
};

const updateEvent = async (eventId, title, startDate, endDate, location, notes) => {
  try {
    const hasPermission = await RNCalendarEvents.checkPermissions();
    if (hasPermission !== 'authorized') {
      throw new Error('Calendar permission not granted');
    }

    await RNCalendarEvents.saveEvent(title, {
      id: eventId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      location: location,
      notes: notes,
      alarms: [
        { date: -30 } // Reminder 30 minutes before the event
      ]
    });

    return true;
  } catch (error) {
    console.error('Error updating event:', error);
    return false;
  }
};

const deleteEvent = async (eventId) => {
  try {
    const hasPermission = await RNCalendarEvents.checkPermissions();
    if (hasPermission !== 'authorized') {
      throw new Error('Calendar permission not granted');
    }

    await RNCalendarEvents.removeEvent(eventId);
    return true;
  } catch (error) {
    console.error('Error deleting event:', error);
    return false;
  }
};

const App: () => React$Node = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(new Date().getTime() + 60 * 60 * 1000));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);


  const handleFetchEvents = async () => {
    const startDate = moment().add(-1, 'days').endOf('day');
    const endDate = moment().add(250, 'days').endOf('day');
    const fetchedEvents = await fetchAllEvents(startDate, endDate);
    setEvents(fetchedEvents);
    Alert.alert('Events Fetched', `Found ${fetchedEvents.length} events`);
  };

  const handleCreateEvent = async () => {
    const startDate = moment().add(1, 'hours');
    const endDate = moment().add(2, 'hours');

    const eventId = await createEvent(title, startDate, endDate, location, notes);
    if (eventId) {
      Alert.alert('Event Created', `Event created with ID: ${eventId}`);
      handleFetchEvents(); // Refresh the event list
      clearForm();
    } else {
      Alert.alert('Error', 'Failed to create event');
    }
  };

  const handleUpdateEvent = async () => {
    if (!selectedEvent) {
      Alert.alert('Error', 'No event selected');
      return;
    }

    const startDate = moment(selectedEvent.startDate);
    const endDate = moment(selectedEvent.endDate);

    const success = await updateEvent(selectedEvent.id, title, startDate, endDate, location, notes);
    if (success) {
      Alert.alert('Event Updated', 'Event updated successfully');
      handleFetchEvents(); // Refresh the event list
      clearForm();
    } else {
      Alert.alert('Error', 'Failed to update event');
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) {
      Alert.alert('Error', 'No event selected');
      return;
    }

    const success = await deleteEvent(selectedEvent.id);
    if (success) {
      Alert.alert('Event Deleted', 'Event deleted successfully');
      handleFetchEvents(); // Refresh the event list
      clearForm();
    } else {
      Alert.alert('Error', 'Failed to delete event');
    }
  };

  const selectEvent = (event) => {
    setSelectedEvent(event);
    setTitle(event.title);
    setLocation(event.location || '');
    setNotes(event.notes || '');
  };

  const clearForm = () => {
    setSelectedEvent(null);
    setTitle('');
    setLocation('');
    setNotes('');
  };
  const onChangeDate = (event, selectedDate, isStartDate) => {
    const currentDate = selectedDate || (isStartDate ? startDate : endDate);
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
      setShowEndPicker(false);
    }
    if (isStartDate) {
      setStartDate(currentDate);
      if (currentDate > endDate) {
        setEndDate(new Date(currentDate.getTime() + 60 * 60 * 1000));
      }
    } else {
      setEndDate(currentDate);
    }
  };

  const showDatepicker = (isStartDate) => {
    if (isStartDate) {
      setShowStartPicker(true);
      setShowEndPicker(false);
    } else {
      setShowStartPicker(false);
      setShowEndPicker(true);
    }
  };

  const requestCalendarPermissions = async () => {
    try {
      const result = await RNCalendarEvents.requestPermissions(false);
      if (result === 'authorized') {
        Alert.alert('Success', 'Calendar permissions granted');
      } else {
        Alert.alert('Error', 'Calendar permissions not granted');
      }
    } catch (error) {
      console.error('Error requesting calendar permissions:', error);
      Alert.alert('Error', 'Failed to request calendar permissions');
    }
  };


  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={styles.scrollView}>
          <Button
            title="Request Permissions"
            onPress={requestCalendarPermissions}
            color="blue"
          />
          <View style={styles.body}>
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
              <TouchableOpacity onPress={() => showDatepicker(true)} style={styles.dateButton}>
                <Text>Start: {moment(startDate).format('MMMM Do YYYY, h:mm a')}</Text>
              </TouchableOpacity>
              {showStartPicker && (
                <DateTimePicker
                  testID="startDateTimePicker"
                  value={startDate}
                  mode="datetime"
                  // is24Hour={true}
                  display="default"
                  onChange={(event, date) => onChangeDate(event, date, true)}
                />
              )}
              <TouchableOpacity onPress={() => showDatepicker(false)} style={styles.dateButton}>
                <Text>End: {moment(endDate).format('MMMM Do YYYY, h:mm a')}</Text>
              </TouchableOpacity>
              {showEndPicker && (
                <DateTimePicker
                  testID="endDateTimePicker"
                  value={endDate}
                  mode="datetime"
                  // is24Hour={true}
                  display="default"
                  onChange={(event, date) => onChangeDate(event, date, false)}
                />
              )}
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
                onPress={handleFetchEvents}
              />
              {events.map((event, index) => (
                <Text key={index} style={styles.eventItem} onPress={() => selectEvent(event)}>
                  {event.title} - {moment(event.startDate).format('MMMM Do YYYY, h:mm a')}
                </Text>
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
    fontSize: 14,
    color: 'black',
    marginBottom: 5,
    padding: 10,
    backgroundColor: '#f0f0f0',
  },
  input: {
    height: 40,
    color: 'bleck',
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
});

export default App;