package toshihide.matsuda.stationalarm

import android.content.Context
import android.media.AudioManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class HeadphoneDetectionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "HeadphoneDetection"

    @ReactMethod
    fun isHeadphonesConnected(promise: Promise) {
        try {
            val audioManager =
                reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val isWired = audioManager.isWiredHeadsetOn
            val isBluetooth = audioManager.isBluetoothA2dpOn
            promise.resolve(isWired || isBluetooth)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check headphone status", e)
        }
    }
}
