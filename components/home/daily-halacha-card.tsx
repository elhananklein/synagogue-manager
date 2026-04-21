import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
type DailyHalachaCardProps = {
  title: string;
  text: string;
};

export function DailyHalachaCard({ title, text }: DailyHalachaCardProps) {
  return (
    <Card id="halacha">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>לזכות רפואת כל חולי עמו ישראל</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="leading-8 text-base">{text}</p>
      </CardContent>
    </Card>
  );
}
