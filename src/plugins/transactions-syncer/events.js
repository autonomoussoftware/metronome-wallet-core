'use strict'

function createEventsRegistry() {
  const registeredEvents = []

  return {
    getAllRegisteredEvents: () => registeredEvents,
    registerEvent: registration => registeredEvents.push(registration)
  }
}

module.exports = createEventsRegistry
