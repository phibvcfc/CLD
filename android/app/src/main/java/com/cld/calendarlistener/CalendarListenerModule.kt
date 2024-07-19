package com.cld.calendarlistener

import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CalendarListenerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "CalendarListener"
    }

    @ReactMethod
    fun startListening() {
        Log.e("dqqrqeq", "");
        val serviceIntent = Intent(reactContext, CalendarListenerService::class.java)
        reactContext.startService(serviceIntent)
    }

    @ReactMethod
    fun stopListening() {
        val serviceIntent = Intent(reactContext, CalendarListenerService::class.java)
        reactContext.stopService(serviceIntent)
    }
}
