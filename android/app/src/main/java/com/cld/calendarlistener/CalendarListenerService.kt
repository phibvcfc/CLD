package com.cld.calendarlistener

import android.app.Service
import android.content.Intent
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.os.IBinder
import android.provider.CalendarContract
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class CalendarListenerService : Service() {

    private var calendarObserver: CalendarObserver? = null
    private var reactContext: ReactApplicationContext? = null

    override fun onCreate() {
        super.onCreate()
        calendarObserver = CalendarObserver(Handler())
        contentResolver.registerContentObserver(
            CalendarContract.Events.CONTENT_URI, true, calendarObserver!!
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onDestroy() {
        super.onDestroy()
        calendarObserver?.let {
            contentResolver.unregisterContentObserver(it)
        }
    }

    fun setReactContext(context: ReactApplicationContext) {
        this.reactContext = context
    }

    private inner class CalendarObserver(handler: Handler) : ContentObserver(handler) {
        override fun onChange(selfChange: Boolean, uri: Uri?) {
            super.onChange(selfChange, uri)
            reactContext?.let {
                val params = Arguments.createMap().apply {
                    putString("message", "Calendar changed")
                }
                sendEvent("calendarChanged", params)
                Log.e("Dhada", "Dadad");
            }
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(eventName, params)
    }
}
