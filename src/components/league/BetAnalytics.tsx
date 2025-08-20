import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  DollarSign, 
  Trophy, 
  Flame,
  BarChart3,
  Calendar,
  Coins
} from "lucide-react";
import { getBetAnalytics } from "@/lib/services/betSettlement";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  leagueId: string;
}

export default function BetAnalytics({ leagueId }: Props) {
  const { user } = useAuth();

  // Guard clause to prevent crash when user is not loaded
  if (!user) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground mt-2">Loading user...</p>
      </div>
    );
  }

  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['bet-analytics', leagueId, user.id],
    enabled: !!leagueId && !!user.id,
    queryFn: () => getBetAnalytics(user.id, leagueId),
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground mt-2">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">Failed to load analytics.</p>
      </div>
    );
  }

  if (!analytics || analytics.total_bets === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Betting History</h3>
        <p className="text-sm text-muted-foreground">Start placing bets to see your analytics!</p>
      </div>
    );
  }

  const winRateColor = analytics.win_rate >= 60 ? 'text-green-600' : 
                      analytics.win_rate >= 50 ? 'text-yellow-600' : 'text-red-600';

  const profitColor = analytics.net_profit >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-primary mb-2">Betting Analytics</h2>
        <p className="text-muted-foreground">Your comprehensive betting performance overview</p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Bets */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Bets</p>
                <p className="text-2xl font-bold text-blue-900">{analytics.total_bets}</p>
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Win Rate */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Win Rate</p>
                <p className={`text-2xl font-bold ${winRateColor}`}>{analytics.win_rate.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Net Profit</p>
                <p className={`text-2xl font-bold ${profitColor}`}>
                  {analytics.net_profit >= 0 ? '+' : ''}{analytics.net_profit} tokens
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        {/* Current Streak */}
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Current Streak</p>
                <p className="text-2xl font-bold text-orange-900">
                  {analytics.current_streak > 0 ? '+' : ''}{analytics.current_streak}
                </p>
              </div>
              <Flame className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Wins</span>
                <div className="flex items-center gap-2">
                  <Progress value={analytics.wins / analytics.total_bets * 100} className="w-20" />
                  <span className="text-sm font-semibold text-green-600">{analytics.wins}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Losses</span>
                <div className="flex items-center gap-2">
                  <Progress value={analytics.losses / analytics.total_bets * 100} className="w-20" />
                  <span className="text-sm font-semibold text-red-600">{analytics.losses}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Pushes</span>
                <div className="flex items-center gap-2">
                  <Progress value={analytics.pushes / analytics.total_bets * 100} className="w-20" />
                  <span className="text-sm font-semibold text-gray-600">{analytics.pushes}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600 font-medium">Total Won</p>
                <p className="text-xl font-bold text-green-700">+{analytics.total_won}</p>
              </div>
              
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-red-600 font-medium">Total Lost</p>
                <p className="text-xl font-bold text-red-700">-{analytics.total_lost}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Average Bet Size:</span>
                <span className="font-semibold">{analytics.average_bet_size.toFixed(1)} tokens</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span>Largest Win:</span>
                <span className="font-semibold text-green-600">+{analytics.largest_win}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span>Largest Loss:</span>
                <span className="font-semibold text-red-600">-{analytics.largest_loss}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Streak Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5" />
            Streak Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-center p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg">
              <p className="text-sm text-orange-600 font-medium mb-2">Current Streak</p>
              <div className="flex items-center justify-center gap-2">
                {analytics.current_streak > 0 ? (
                  <TrendingUp className="h-6 w-6 text-green-600" />
                ) : analytics.current_streak < 0 ? (
                  <TrendingDown className="h-6 w-6 text-red-600" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-gray-300" />
                )}
                <span className="text-2xl font-bold text-orange-700">
                  {analytics.current_streak > 0 ? '+' : ''}{analytics.current_streak}
                </span>
              </div>
              <p className="text-xs text-orange-600 mt-1">
                {analytics.current_streak > 0 ? 'Winning streak!' : 
                 analytics.current_streak < 0 ? 'Losing streak' : 'No current streak'}
              </p>
            </div>
            
            <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
              <p className="text-sm text-purple-600 font-medium mb-2">Best Streak</p>
              <div className="flex items-center justify-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-600" />
                <span className="text-2xl font-bold text-purple-700">{analytics.best_streak}</span>
              </div>
              <p className="text-xs text-purple-600 mt-1">
                {analytics.best_streak > 0 ? 'Consecutive wins/losses' : 'No streak yet'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-6">
          <h3 className="font-semibold text-lg mb-4 text-center">📊 Betting Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p><strong>Win Rate:</strong> {analytics.win_rate >= 60 ? 'Excellent! You\'re beating the house.' : 
                                            analytics.win_rate >= 50 ? 'Good! You\'re around break-even.' : 
                                            'Keep improving! Focus on better bet selection.'}</p>
              
              <p><strong>Profitability:</strong> {analytics.net_profit >= 0 ? 'Profitable! You\'re making money.' : 
                                                 'Currently down. Consider adjusting your strategy.'}</p>
            </div>
            
            <div className="space-y-2">
              <p><strong>Streak:</strong> {analytics.current_streak > 0 ? 'Hot streak! Keep the momentum going.' : 
                                          analytics.current_streak < 0 ? 'Cold streak. Don\'t chase losses.' : 
                                          'Fresh start. Time to build a new streak!'}</p>
              
              <p><strong>Bet Size:</strong> {analytics.average_bet_size > 50 ? 'High roller! Manage your bankroll carefully.' : 
                                            analytics.average_bet_size > 20 ? 'Moderate bettor. Good balance.' : 
                                            'Conservative bettor. Consider increasing stakes gradually.'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
