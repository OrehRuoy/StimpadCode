#import <Foundation/Foundation.h>
#import <UserNotifications/UserNotifications.h>

// Local notifications only. No push, no Firebase Messaging.
// Godot talks to this file through Documents/local_notifications (user://).

static NSString *StimPadBridgeDir(void) {
	NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
	NSString *docs = paths.firstObject;
	if (docs == nil) {
		return nil;
	}
	NSString *dir = [docs stringByAppendingPathComponent:@"local_notifications"];
	[[NSFileManager defaultManager] createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:nil];
	return dir;
}

static NSDictionary *StimPadReadJSON(NSString *name) {
	NSString *dir = StimPadBridgeDir();
	if (dir == nil) {
		return nil;
	}
	NSData *data = [NSData dataWithContentsOfFile:[dir stringByAppendingPathComponent:name]];
	if (data == nil || data.length == 0) {
		return nil;
	}
	id obj = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
	if (![obj isKindOfClass:[NSDictionary class]]) {
		return nil;
	}
	return (NSDictionary *)obj;
}

static void StimPadWriteJSON(NSString *name, NSDictionary *payload) {
	NSString *dir = StimPadBridgeDir();
	if (dir == nil) {
		return;
	}
	NSData *data = [NSJSONSerialization dataWithJSONObject:payload options:0 error:nil];
	if (data == nil) {
		return;
	}
	NSString *finalPath = [dir stringByAppendingPathComponent:name];
	NSString *tmpPath = [finalPath stringByAppendingString:@".tmp"];
	[data writeToFile:tmpPath atomically:YES];
	[[NSFileManager defaultManager] removeItemAtPath:finalPath error:nil];
	[[NSFileManager defaultManager] moveItemAtPath:tmpPath toPath:finalPath error:nil];
}

@interface StimPadLocalNotifications : NSObject <UNUserNotificationCenterDelegate>
@property (nonatomic, assign) NSInteger lastCommandId;
@property (nonatomic, assign) BOOL polling;
@end

@implementation StimPadLocalNotifications

+ (instancetype)shared {
	static StimPadLocalNotifications *instance = nil;
	static dispatch_once_t once;
	dispatch_once(&once, ^{
		instance = [StimPadLocalNotifications new];
		instance.lastCommandId = -1;
	});
	return instance;
}

- (void)start {
	dispatch_async(dispatch_get_main_queue(), ^{
		UNUserNotificationCenter *center = UNUserNotificationCenter.currentNotificationCenter;
		center.delegate = self;
		if (self.polling) {
			return;
		}
		self.polling = YES;
		[self poll];
	});
}

- (void)poll {
	[self processCommand];
	dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.35 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
		[self poll];
	});
}

- (void)processCommand {
	NSDictionary *cmd = StimPadReadJSON(@"command.json");
	if (cmd == nil) {
		return;
	}
	NSInteger cmdId = [cmd[@"id"] integerValue];
	if (cmdId == self.lastCommandId) {
		return;
	}
	self.lastCommandId = cmdId;
	NSString *op = [cmd[@"op"] isKindOfClass:[NSString class]] ? cmd[@"op"] : @"";
	if ([op isEqualToString:@"request_permission"]) {
		[self requestPermission:cmdId];
		return;
	}
	if ([op isEqualToString:@"status"]) {
		[self writeStatus:cmdId op:@"status"];
		return;
	}
	if ([op isEqualToString:@"cancel_all"]) {
		UNUserNotificationCenter *center = UNUserNotificationCenter.currentNotificationCenter;
		[center removeAllPendingNotificationRequests];
		StimPadWriteJSON(@"result.json", @{@"id": @(cmdId), @"op": op, @"ok": @YES});
		return;
	}
	if ([op isEqualToString:@"schedule"]) {
		[self scheduleItems:cmd[@"items"] commandId:cmdId];
		return;
	}
	StimPadWriteJSON(@"result.json", @{@"id": @(cmdId), @"op": op, @"ok": @NO});
}

- (NSString *)statusName:(UNAuthorizationStatus)status {
	switch (status) {
		case UNAuthorizationStatusAuthorized:
		case UNAuthorizationStatusProvisional:
		case UNAuthorizationStatusEphemeral:
			return @"authorized";
		case UNAuthorizationStatusDenied:
			return @"denied";
		default:
			return @"not_determined";
	}
}

- (void)writeStatus:(NSInteger)cmdId op:(NSString *)op {
	UNUserNotificationCenter *center = UNUserNotificationCenter.currentNotificationCenter;
	[center getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
		NSString *name = [self statusName:settings.authorizationStatus];
		BOOL granted = [name isEqualToString:@"authorized"];
		dispatch_async(dispatch_get_main_queue(), ^{
			StimPadWriteJSON(@"result.json", @{
				@"id": @(cmdId),
				@"op": op,
				@"ok": @YES,
				@"granted": @(granted),
				@"status": name,
			});
		});
	}];
}

- (void)requestPermission:(NSInteger)cmdId {
	UNUserNotificationCenter *center = UNUserNotificationCenter.currentNotificationCenter;
	[center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound)
						  completionHandler:^(BOOL granted, NSError *error) {
		dispatch_async(dispatch_get_main_queue(), ^{
			[self writeStatus:cmdId op:@"request_permission"];
			(void)granted;
			(void)error;
		});
	}];
}

- (void)scheduleItems:(id)rawItems commandId:(NSInteger)cmdId {
	if (![rawItems isKindOfClass:[NSArray class]]) {
		StimPadWriteJSON(@"result.json", @{@"id": @(cmdId), @"op": @"schedule", @"ok": @NO});
		return;
	}
	UNUserNotificationCenter *center = UNUserNotificationCenter.currentNotificationCenter;
	[center removeAllPendingNotificationRequests];
	NSMutableArray *ids = [NSMutableArray array];
	for (id raw in (NSArray *)rawItems) {
		if (![raw isKindOfClass:[NSDictionary class]]) {
			continue;
		}
		NSDictionary *item = (NSDictionary *)raw;
		NSString *identifier = [item[@"identifier"] isKindOfClass:[NSString class]] ? item[@"identifier"] : @"";
		if (identifier.length == 0) {
			continue;
		}
		UNMutableNotificationContent *content = [UNMutableNotificationContent new];
		content.title = [item[@"title"] isKindOfClass:[NSString class]] ? item[@"title"] : @"StimPad";
		content.body = [item[@"body"] isKindOfClass:[NSString class]] ? item[@"body"] : @"";
		content.sound = UNNotificationSound.defaultSound;
		NSInteger hour = [item[@"hour"] integerValue];
		content.userInfo = @{@"hour": @(hour), @"kind": @"daily_sound"};
		NSDateComponents *parts = [NSDateComponents new];
		parts.year = [item[@"year"] integerValue];
		parts.month = [item[@"month"] integerValue];
		parts.day = [item[@"day"] integerValue];
		parts.hour = hour;
		parts.minute = [item[@"minute"] integerValue];
		UNCalendarNotificationTrigger *trigger = [UNCalendarNotificationTrigger triggerWithDateMatchingComponents:parts repeats:NO];
		UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:identifier content:content trigger:trigger];
		[center addNotificationRequest:request withCompletionHandler:nil];
		[ids addObject:identifier];
	}
	StimPadWriteJSON(@"result.json", @{@"id": @(cmdId), @"op": @"schedule", @"ok": @YES, @"count": @(ids.count)});
}

- (void)writeOpenedHour:(NSInteger)hour {
	NSInteger token = (NSInteger)([[NSDate date] timeIntervalSince1970] * 1000.0);
	StimPadWriteJSON(@"opened.json", @{@"token": @(token), @"hour": @(hour)});
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
	   willPresentNotification:(UNNotification *)notification
		 withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler {
	(void)center;
	(void)notification;
	completionHandler(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionSound);
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
	didReceiveNotificationResponse:(UNNotificationResponse *)response
			 withCompletionHandler:(void (^)(void))completionHandler {
	(void)center;
	NSInteger hour = -1;
	id rawHour = response.notification.request.content.userInfo[@"hour"];
	if ([rawHour respondsToSelector:@selector(integerValue)]) {
		hour = [rawHour integerValue];
	}
	[self writeOpenedHour:hour];
	completionHandler();
}

@end

extern "C" void local_notification_init(void) {
	[StimPadLocalNotifications.shared start];
}

extern "C" void local_notification_deinit(void) {
}

__attribute__((constructor)) static void stim_pad_local_notifications_boot(void) {
	[StimPadLocalNotifications.shared start];
}
