// ============================================================================
// AnfieldVoice — Gate Call Screen (Slice 1)
// Incoming calls, call history, answer/reject controls
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Vibration,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useWebSocket } from '../../src/hooks/useWebSocket';
import { useWebRtc } from '../../src/hooks/useWebRTC';
import CallScreen from '../../src/components/CallScreen';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/theme';
import { Card } from '../../src/components/Card';
import * as api from '../../src/api/client';
import type { GateCall } from '../../src/types';

export default function GateScreen() {
  const { user } = useAuth();
  const { incomingCall, clearIncomingCall, send, lastEvent, state: wsState } = useWebSocket();
  const {
    callState, answerCall, endCall,
    toggleMute, toggleSpeaker, isMuted, isSpeakerOn, durationSecs,
    handleRemoteSdp, handleRemoteIce, error: webrtcError,
  } = useWebRtc({ sendWs: send });
  const [history, setHistory] = useState<GateCall[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const [activeCallInfo, setActiveCallInfo] = useState<{ callId: number; callerUnit: string } | null>(null);

  // Pulse animation for incoming call
  useEffect(() => {
    if (incomingCall) {
      Vibration.vibrate([0, 500, 300, 500], true);
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => {
        pulse.stop();
        Vibration.cancel();
      };
    } else {
      pulseAnim.setValue(1);
    }
  }, [incomingCall]);

  const loadHistory = useCallback(async () => {
    const result = await api.getGateCalls(undefined, 50, 0);
    if (result.data) setHistory(result.data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const handleAnswer = async () => {
    if (!incomingCall) return;
    send({ type: 'answer_call', call_id: incomingCall.call_id, action: 'answer' });
    await api.gateCallAction(incomingCall.call_id, 'answer');
    setActiveCallInfo({ callId: incomingCall.call_id, callerUnit: incomingCall.caller_unit });
    await answerCall(incomingCall.call_id);
    clearIncomingCall();
  };

  const handleReject = async () => {
    if (!incomingCall) return;
    send({ type: 'answer_call', call_id: incomingCall.call_id, action: 'reject' });
    await api.gateCallAction(incomingCall.call_id, 'reject');
    clearIncomingCall();
  };

  const handleEndCall = () => {
    endCall();
    setActiveCallInfo(null);
  };

  const handleDismissCall = () => {
    setActiveCallInfo(null);
  };

  // Handle incoming WebRTC signalling from WebSocket
  useEffect(() => {
    if (!lastEvent || !activeCallInfo) return;
    const msg = lastEvent as Record<string, unknown>;
    if (msg.type === 'sdp_offer' && typeof msg.sdp === 'string') {
      handleRemoteSdp(msg.call_id as number, msg.sdp, 'offer');
    } else if (msg.type === 'sdp_answer' && typeof msg.sdp === 'string') {
      handleRemoteSdp(msg.call_id as number, msg.sdp, 'answer');
    } else if (msg.type === 'ice_candidate' && typeof msg.candidate === 'string') {
      handleRemoteIce(
        msg.call_id as number,
        msg.candidate as string,
        msg.sdp_mid as string | undefined,
        msg.sdp_mline_index as number | undefined,
      );
    }
  }, [lastEvent, activeCallInfo, handleRemoteSdp, handleRemoteIce]);

  return (
    <View style={styles.container}>
      {/* Incoming Call Overlay */}
      {incomingCall && (
        <View style={styles.callOverlay}>
          <Animated.View style={[styles.callCard, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.callIconContainer}>
              <Ionicons name="call" size={48} color={Colors.success} />
            </View>
            <Text style={styles.callTitle}>Incoming Call</Text>
            <Text style={styles.callSubtitle}>{incomingCall.caller_unit}</Text>
            <Text style={styles.callMeta}>Gate call from building entrance</Text>

            <View style={styles.callActions}>
              <TouchableOpacity style={styles.answerBtn} onPress={handleAnswer} activeOpacity={0.8}>
                <Ionicons name="call" size={28} color={Colors.white} />
                <Text style={styles.answerText}>Answer</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.rejectBtn} onPress={handleReject} activeOpacity={0.8}>
                <Ionicons name="call" size={28} color={Colors.white} />
                <Text style={styles.rejectText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Gate Calls</Text>
        <View style={styles.wsBadge}>
          <View
            style={[
              styles.wsDot,
              { backgroundColor: wsState === 'connected' ? Colors.success : Colors.warning },
            ]}
          />
          <Text style={styles.wsText}>
            {wsState === 'connected' ? 'Connected' : wsState === 'connecting' ? 'Connecting...' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Call History */}
      <ScrollView
        style={styles.scrollArea}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {history.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="call-outline" size={40} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No call history</Text>
            <Text style={styles.emptySubtext}>
              Gate calls will appear here when someone rings your apartment.
            </Text>
          </Card>
        ) : (
          history.map((call) => (
            <Card key={call.call_id} style={styles.historyCard}>
              <View style={styles.historyRow}>
                <View style={styles.historyIcon}>
                  <Ionicons
                    name={
                      call.call_status === 'answered'
                        ? 'checkmark-circle'
                        : call.call_status === 'missed'
                          ? 'close-circle'
                          : 'call'
                    }
                    size={22}
                    color={
                      call.call_status === 'answered'
                        ? Colors.success
                        : call.call_status === 'missed'
                          ? Colors.error
                          : Colors.textSecondary
                    }
                  />
                </View>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyUnit}>{call.caller_unit}</Text>
                  <Text style={styles.historyTime}>
                    {new Date(call.started_at).toLocaleString()}
                    {call.duration_secs ? ` · ${call.duration_secs}s` : ''}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          call.call_status === 'answered'
                            ? Colors.success
                            : call.call_status === 'missed'
                              ? Colors.error
                              : Colors.textSecondary,
                      },
                    ]}
                  >
                    {call.call_status}
                  </Text>
                </View>
              </View>
            </Card>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Active Call Screen */}
      {activeCallInfo && callState !== 'idle' && (
        <CallScreen
          callState={callState}
          callerUnit={activeCallInfo.callerUnit}
          durationSecs={durationSecs}
          isMuted={isMuted}
          isSpeakerOn={isSpeakerOn}
          onToggleMute={toggleMute}
          onToggleSpeaker={toggleSpeaker}
          onEndCall={handleEndCall}
          onDismiss={callState === 'ended' ? handleDismissCall : undefined}
        />
      )}

      {webrtcError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{webrtcError}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  // ── Incoming Call Overlay ──
  callOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  callCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxxl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  callIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.success + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  callTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  callSubtitle: {
    color: Colors.primaryLight,
    fontSize: FontSize.lg,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  callMeta: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginBottom: Spacing.xxl,
  },
  callActions: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  answerBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  answerText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  rejectBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    transform: [{ rotate: '135deg' }],
  } as Record<string, unknown>,
  rejectText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: '700',
    transform: [{ rotate: '-135deg' }],
  } as Record<string, unknown>,
  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  wsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  wsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  wsText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  // ── History ──
  scrollArea: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  emptyCard: {
    padding: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  emptySubtext: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  historyCard: {
    marginBottom: Spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  historyInfo: {
    flex: 1,
  },
  historyUnit: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  historyTime: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  errorBanner: {
    position: 'absolute',
    bottom: 100,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.error + 'E0',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    zIndex: 300,
  },
  errorText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    textAlign: 'center',
    fontWeight: '500',
  },
});
