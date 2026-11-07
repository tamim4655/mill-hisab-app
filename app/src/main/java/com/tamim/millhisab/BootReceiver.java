package com.tamim.millhisab;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import java.util.Calendar;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        SharedPreferences p = context.getSharedPreferences("mill_hisab_reminders", Context.MODE_PRIVATE);
        if (!p.getBoolean("enabled", false)) return;
        int hour = p.getInt("hour", 20), minute = p.getInt("minute", 0);
        Calendar when = Calendar.getInstance();
        when.set(Calendar.HOUR_OF_DAY, hour);
        when.set(Calendar.MINUTE, minute);
        when.set(Calendar.SECOND, 0);
        when.set(Calendar.MILLISECOND, 0);
        if (when.getTimeInMillis() <= System.currentTimeMillis()) when.add(Calendar.DAY_OF_YEAR, 1);
        Intent alarmIntent = new Intent(context, DueReminderReceiver.class).setAction(DueReminderReceiver.ACTION_DAILY_REMINDER);
        PendingIntent pending = PendingIntent.getBroadcast(context, 8103, alarmIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        AlarmManager alarm = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarm != null) alarm.setInexactRepeating(AlarmManager.RTC_WAKEUP, when.getTimeInMillis(), AlarmManager.INTERVAL_DAY, pending);
    }
}