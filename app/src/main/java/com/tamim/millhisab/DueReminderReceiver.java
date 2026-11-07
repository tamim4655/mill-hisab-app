package com.tamim.millhisab;

import android.app.BroadcastReceiver;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

public class DueReminderReceiver extends BroadcastReceiver {
    public static final String ACTION_DAILY_REMINDER = "com.tamim.millhisab.DAILY_REMINDER";
    private static final String CHANNEL_ID = "mill_hisab_due_reminders";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_DAILY_REMINDER.equals(intent.getAction())) return;
        if (Build.VERSION.SDK_INT >= 33 &&
                context.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "বকেয়া মনে করিয়ে দেওয়া", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("মিল হিসাব অ্যাপের দৈনিক বকেয়া নোটিফিকেশন");
            NotificationManager nm = context.getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
        Intent open = new Intent(context, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(context, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(context, CHANNEL_ID) : new Notification.Builder(context);
        b.setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("মিল হিসাবের দৈনিক মনে করিয়ে দেওয়া")
                .setContentText("আজকের মিল, জমা ও বকেয়ার হিসাব দেখে নিন।")
                .setContentIntent(pending).setAutoCancel(true);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(8103, b.build());
    }
}