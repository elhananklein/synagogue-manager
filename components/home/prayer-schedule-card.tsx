import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PrayerSlot } from "@/lib/data/mock-content";

type PrayerScheduleCardProps = {
  items: PrayerSlot[];
};

export function PrayerScheduleCard({ items }: PrayerScheduleCardProps) {
  return (
    <Card id="zmanim">
      <CardHeader>
        <CardTitle>זמני תפילה להיום</CardTitle>
        <CardDescription>נוסח ספרד | בית הכנסת המרכזי</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
              <div>
                <p className="font-medium">{item.prayerName}</p>
                {item.notes ? <p className="text-xs text-muted-foreground">{item.notes}</p> : null}
              </div>
              <p className="text-lg font-semibold text-primary">{item.time}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
